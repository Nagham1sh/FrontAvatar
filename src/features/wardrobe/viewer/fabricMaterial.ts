import * as THREE from 'three';
import type { FabricPattern, FabricRenderProfile } from '../fabrics';

const PATTERN_SIZE = 128;
const patternCache = new Map<FabricPattern, HTMLCanvasElement>();

/** Small grayscale height map drawn on a canvas; used as a bump map. */
function patternCanvas(pattern: FabricPattern): HTMLCanvasElement {
  const cached = patternCache.get(pattern);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PATTERN_SIZE;
  const ctx = canvas.getContext('2d')!;
  const s = PATTERN_SIZE;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, s, s);

  // Deterministic pseudo-random so the texture is identical on every render.
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  if (pattern === 'weave') {
    const cell = s / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const horizontal = (x + y) % 2 === 0;
        const g = ctx.createLinearGradient(
          x * cell, y * cell,
          horizontal ? x * cell : (x + 1) * cell,
          horizontal ? (y + 1) * cell : y * cell,
        );
        g.addColorStop(0, '#5a5a5a');
        g.addColorStop(0.5, '#c8c8c8');
        g.addColorStop(1, '#5a5a5a');
        ctx.fillStyle = g;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  } else if (pattern === 'twill') {
    ctx.strokeStyle = '#cfcfcf';
    ctx.lineWidth = 5;
    for (let i = -s; i < s * 2; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + s, s);
      ctx.stroke();
    }
  } else if (pattern === 'knit') {
    ctx.strokeStyle = '#d6d6d6';
    ctx.lineWidth = 6;
    const w = s / 4;
    for (let row = 0; row < s; row += 16) {
      for (let col = 0; col < s; col += w) {
        ctx.beginPath();
        ctx.moveTo(col, row);
        ctx.lineTo(col + w / 2, row + 14);
        ctx.lineTo(col + w, row);
        ctx.stroke();
      }
    }
  } else {
    const density = pattern === 'plain' ? 400 : pattern === 'pile' ? 5000 : 1600;
    const radius = pattern === 'grain' ? 2.2 : 1;
    for (let i = 0; i < density; i++) {
      const v = Math.floor(90 + rand() * 120);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.arc(rand() * s, rand() * s, radius * (0.5 + rand()), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  patternCache.set(pattern, canvas);
  return canvas;
}

export type FabricMaterialOptions = {
  color: string;
  map?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  side?: THREE.Side;
};

/**
 * Physically-based *appearance* for a fabric (roughness, sheen, gloss, weave).
 * It changes how light hits the surface; it does not simulate cloth physics.
 */
export function createFabricMaterial(
  profile: FabricRenderProfile,
  { color, map = null, normalMap = null, side = THREE.FrontSide }: FabricMaterialOptions,
): THREE.MeshPhysicalMaterial {
  const bump = new THREE.CanvasTexture(patternCanvas(profile.pattern));
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(profile.patternRepeat, profile.patternRepeat);
  bump.colorSpace = THREE.NoColorSpace;

  const material = new THREE.MeshPhysicalMaterial({
    color: map ? '#ffffff' : color,
    map,
    normalMap,
    bumpMap: normalMap ? null : bump,
    bumpScale: profile.bumpScale,
    roughness: profile.roughness,
    metalness: 0,
    sheen: profile.sheen,
    sheenRoughness: profile.sheenRoughness,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5),
    clearcoat: profile.clearcoat,
    clearcoatRoughness: 0.4,
    transparent: profile.opacity < 1,
    opacity: profile.opacity,
    side,
  });
  material.userData.ownedTextures = normalMap ? [] : [bump];
  return material;
}

export function disposeFabricMaterial(material: THREE.Material): void {
  for (const texture of (material.userData.ownedTextures ?? []) as THREE.Texture[]) texture.dispose();
  material.dispose();
}
