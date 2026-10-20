import * as THREE from 'three';

const MAX_SIZE = 1024;

/**
 * Turns a product photo into a texture for the flat-lay preview:
 *  1. finds the garment's bounding box (non-transparent pixels, or pixels that
 *     differ from the background colour sampled at the corners),
 *  2. crops to it so the garment roughly covers the silhouette,
 *  3. paints background / transparent areas with the garment colour.
 * This is a projection of a 2D photo, not a reconstruction of 3D shape.
 */
export function createPhotoTexture(image: HTMLImageElement, fillColor: string): THREE.CanvasTexture {
  const scale = Math.min(1, MAX_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));

  const source = document.createElement('canvas');
  source.width = w;
  source.height = h;
  const sctx = source.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(image, 0, 0, w, h);

  let crop = { x: 0, y: 0, w, h };
  try {
    const pixels = sctx.getImageData(0, 0, w, h);
    const analysis = analyzePhoto(pixels);
    if (analysis) {
      crop = analysis.bounds;
      // Background showing between sleeves / around the body takes the garment colour.
      const fill = new THREE.Color(fillColor);
      const [fr, fg, fb] = [fill.r * 255, fill.g * 255, fill.b * 255];
      const d = pixels.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!analysis.isGarment(i)) {
          d[i] = fr;
          d[i + 1] = fg;
          d[i + 2] = fb;
          d[i + 3] = 255;
        }
      }
      sctx.putImageData(pixels, 0, 0);
    }
  } catch {
    // Tainted canvas (cross-origin image): use the full photo.
  }

  const out = document.createElement('canvas');
  out.width = crop.w;
  out.height = crop.h;
  const octx = out.getContext('2d')!;
  octx.fillStyle = fillColor;
  octx.fillRect(0, 0, crop.w, crop.h);
  octx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

  const texture = new THREE.CanvasTexture(out);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

type PhotoAnalysis = {
  bounds: { x: number; y: number; w: number; h: number };
  isGarment: (index: number) => boolean;
  averageColor: string;
};

function analyzePhoto({ data, width, height }: ImageData): PhotoAnalysis | null {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1].map((i) => i * 4);
  const transparentBg = corners.every((i) => data[i + 3] < 30);
  const bg = [0, 1, 2].map((c) => corners.reduce((sum, i) => sum + data[i + c], 0) / corners.length);

  const isGarment = (i: number) =>
    transparentBg
      ? data[i + 3] > 40
      : data[i + 3] > 40 &&
        Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 60;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const sum = [0, 0, 0];
  let count = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      if (!isGarment(i)) continue;
      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const bw = maxX - minX;
  const bh = maxY - minY;
  // Ignore implausible detections (noise, or the "garment" fills everything).
  if (bw < width * 0.2 || bh < height * 0.2) return null;
  const averageColor = `#${sum.map((v) => Math.round(v / count).toString(16).padStart(2, '0')).join('')}`;
  return { bounds: { x: minX, y: minY, w: bw + 1, h: bh + 1 }, isGarment, averageColor };
}

/** Average colour of the garment in a product photo (ignores the background), or null. */
export function estimateGarmentColor(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        resolve(analyzePhoto(ctx.getImageData(0, 0, canvas.width, canvas.height))?.averageColor ?? null);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}
