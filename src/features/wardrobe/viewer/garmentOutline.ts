import type { GarmentMeasurements, GarmentType } from '../types';

export type Point = [number, number];

export type GarmentOutline = {
  /** Closed, symmetric polygon in cm. y = 0 is the hem, y = height is the top. */
  points: Point[];
  width: number;
  height: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function pick(m: GarmentMeasurements, key: keyof GarmentMeasurements, fallback: number): number {
  const v = m[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Quarter-ellipse samples from `from` to `to`, bulging along the first axis first. */
function curve(from: Point, to: Point, steps = 5, horizontalFirst = true): Point[] {
  const out: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    const a = horizontalFirst ? Math.sin(t) : 1 - Math.cos(t);
    const b = horizontalFirst ? 1 - Math.cos(t) : Math.sin(t);
    out.push([from[0] + (to[0] - from[0]) * a, from[1] + (to[1] - from[1]) * b]);
  }
  return out;
}

/** Right half from the top centre (x = 0) to the bottom centre (x = 0). */
function topHalf(type: 'tshirt' | 'shirt' | 'jacket', m: GarmentMeasurements): Point[] {
  const chest = pick(m, 'chest', 100);
  const L = pick(m, 'length', type === 'jacket' ? 72 : 70);
  const hw = chest / 4;
  const hemHalf = pick(m, 'waist', chest * 0.96) / 4;
  const shoulderHalf = clamp(pick(m, 'shoulder', chest * 0.44) / 2, hw * 0.6, hw * 1.3);
  const neckHalf = clamp(pick(m, 'neck', chest * 0.4) / 2 / Math.PI * 1.15, 5, shoulderHalf * 0.7);
  const neckDrop = type === 'tshirt' ? 8 : type === 'shirt' ? 5 : 13;
  const sleeve = pick(m, 'sleeveLength', type === 'tshirt' ? 20 : 60);
  const armhole = clamp(chest * 0.23, 14, L * 0.45);
  const angle = (type === 'tshirt' ? 32 : 62) * (Math.PI / 180);
  const sleeveWidth = type === 'tshirt' ? clamp(chest * 0.17, 12, 26) : clamp(chest * 0.11, 9, 18);

  const shoulder: Point = [shoulderHalf, L - 4];
  const dir: Point = [Math.cos(angle), -Math.sin(angle)];
  const normal: Point = [-Math.sin(angle), -Math.cos(angle)];
  const sleeveTop: Point = [shoulder[0] + dir[0] * sleeve, shoulder[1] + dir[1] * sleeve];
  const sleeveBottom: Point = [sleeveTop[0] + normal[0] * sleeveWidth, sleeveTop[1] + normal[1] * sleeveWidth];
  const underarm: Point = [hw, L - armhole];

  return [
    [0, L - neckDrop],
    ...curve([0, L - neckDrop], [neckHalf, L], 5, true),
    shoulder,
    sleeveTop,
    sleeveBottom,
    underarm,
    [hemHalf, 0],
    [0, 0],
  ];
}

function dressHalf(m: GarmentMeasurements): Point[] {
  const chest = pick(m, 'chest', 90);
  const waist = pick(m, 'waist', chest * 0.8);
  const hips = pick(m, 'hips', chest * 1.05);
  const L = pick(m, 'length', 100);
  const shoulderHalf = clamp(pick(m, 'shoulder', chest * 0.4) / 2, 10, chest / 4);
  const neckHalf = clamp(shoulderHalf * 0.45, 5, 10);
  const waistY = L - clamp(L * 0.4, 30, 44);
  const hipY = Math.max(waistY - 20, L * 0.25);
  const hemHalf = Math.max(hips / 4, hips / 4 + L * 0.12);
  const armholeY = L - clamp(chest * 0.22, 14, 24);

  return [
    [0, L - 12],
    ...curve([0, L - 12], [neckHalf, L], 5, true),
    [shoulderHalf, L - 2],
    ...curve([shoulderHalf, L - 2], [chest / 4, armholeY], 5, false),
    [waist / 4, waistY],
    [hips / 4, hipY],
    [hemHalf, 0],
    [0, 0],
  ];
}

function pantsHalf(m: GarmentMeasurements): Point[] {
  const waist = pick(m, 'waist', 80);
  const hips = Math.max(pick(m, 'hips', waist * 1.2), waist);
  const L = pick(m, 'length', 100);
  const inseam = clamp(pick(m, 'inseam', L - 26), L * 0.4, L - 10);
  const rise = L - inseam;
  const thighHalfFlat = clamp(pick(m, 'thigh', hips * 0.6) / 2, 10, hips / 4);
  const opening = clamp(pick(m, 'legOpening', 40) / 2, 8, thighHalfFlat * 1.6);
  const outer = hips / 4;
  const inner = Math.max(0, outer - thighHalfFlat);
  const legCenter = (outer + inner) / 2;

  return [
    [0, L],
    [waist / 4, L],
    [outer, L - rise * 0.6],
    [legCenter + opening / 2, 0],
    [legCenter - opening / 2, 0],
    [inner, inseam],
    [0, inseam],
  ];
}

function skirtHalf(m: GarmentMeasurements): Point[] {
  const waist = pick(m, 'waist', 72);
  const hips = Math.max(pick(m, 'hips', waist * 1.3), waist);
  const L = pick(m, 'length', 60);
  const hipY = Math.max(L - 18, L * 0.5);
  const hemHalf = hips / 4 + L * 0.15;

  return [
    [0, L],
    [waist / 4, L],
    [hips / 4, hipY],
    [hemHalf, 0],
    [0, 0],
  ];
}

/**
 * Approximate flat-lay silhouette built from the garment's stored measurements.
 * It is a visual preview only — not a pattern, not a fitted 3D garment.
 */
export function buildGarmentOutline(type: GarmentType, measurements: GarmentMeasurements = {}): GarmentOutline {
  const half =
    type === 'dress'
      ? dressHalf(measurements)
      : type === 'pants'
        ? pantsHalf(measurements)
        : type === 'skirt'
          ? skirtHalf(measurements)
          : topHalf(type, measurements);

  const inner = half.slice(1, -1);
  const mirrored = inner.map(([x, y]) => [-x, y] as Point).reverse();
  const points: Point[] = [...half, ...mirrored];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return { points, width: maxX - minX, height: maxY - minY };
}
