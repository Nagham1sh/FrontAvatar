import type { ClothingSize } from './fitLogic';

export type ClothingSizeInfo = {
  label: ClothingSize;
  chestCm: number;
  model: string;
};

export const CLOTHING_SIZES: Record<ClothingSize, ClothingSizeInfo> = {
  S: {
    label: 'S',
    chestCm: 96,
    model: '/models/shirt_S.glb',
  },
  M: {
    label: 'M',
    chestCm: 104,
    model: '/models/shirt_M.glb',
  },
  L: {
    label: 'L',
    chestCm: 112,
    model: '/models/shirt_L.glb',
  },
  XL: {
    label: 'XL',
    chestCm: 120,
    model: '/models/shirt_XL.glb',
  },
};
