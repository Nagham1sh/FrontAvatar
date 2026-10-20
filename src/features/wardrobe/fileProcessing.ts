/** Converting files picked by the shop owner into storable data URLs. */

export const IMAGE_MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const IMAGE_MAX_DIMENSION = 1200;
export const MODEL_MAX_BYTES = 25 * 1024 * 1024;

export class FileProcessingError extends Error {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new FileProcessingError('تعذّر قراءة الصورة. جرّب ملفًا آخر (JPG أو PNG أو WebP).'));
    image.src = src;
  });
}

/**
 * Downscales the image (keeps transparency) so it can be stored in the browser
 * and sent to the fitting room without huge payloads.
 */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new FileProcessingError('الملف المختار ليس صورة.');
  }
  if (file.size > IMAGE_MAX_INPUT_BYTES) {
    throw new FileProcessingError('حجم الصورة كبير جدًا (الحد الأقصى 15 ميغابايت).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new FileProcessingError('المتصفح لا يدعم معالجة الصور.');
    context.drawImage(image, 0, 0, width, height);

    // WebP keeps alpha; browsers without WebP encoding fall back to PNG.
    return canvas.toDataURL('image/webp', 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new FileProcessingError('تعذّر قراءة الملف.'));
    reader.readAsDataURL(file);
  });
}

/** Accepts binary glTF (.glb) only: a .gltf needs its side files, which a single upload cannot carry. */
export async function modelFileToDataUrl(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith('.glb')) {
    throw new FileProcessingError('يُقبل نموذج ثلاثي الأبعاد بصيغة ‎.glb فقط.');
  }
  if (file.size > MODEL_MAX_BYTES) {
    throw new FileProcessingError('حجم النموذج كبير جدًا (الحد الأقصى 25 ميغابايت).');
  }

  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const magic = String.fromCharCode(...header);
  if (magic !== 'glTF') {
    throw new FileProcessingError('الملف لا يبدو نموذج GLB صالحًا.');
  }

  const dataUrl = await readAsDataUrl(file);
  return dataUrl.replace(/^data:[^;]*;/, 'data:model/gltf-binary;');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ك.ب`;
  return `${(bytes / 1024 / 1024).toFixed(1)} م.ب`;
}
