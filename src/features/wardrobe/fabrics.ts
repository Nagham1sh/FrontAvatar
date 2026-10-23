import type { FabricId, StretchLevel } from './types';

/** Surface pattern used to generate a small bump texture for the 3D preview. */
export type FabricPattern = 'plain' | 'weave' | 'twill' | 'knit' | 'grain' | 'pile';

/**
 * Visual material settings only. They change how the surface looks under light
 * (roughness, sheen, gloss, weave). They do NOT simulate drape, stretch or
 * weight — there is no cloth physics in this project.
 */
export type FabricRenderProfile = {
  roughness: number;
  sheen: number;
  sheenRoughness: number;
  clearcoat: number;
  opacity: number;
  pattern: FabricPattern;
  /** Pattern repeats across the texture's UV range. */
  patternRepeat: number;
  bumpScale: number;
};

export type FabricInfo = {
  id: FabricId;
  label: string;
  description: string;
  render: FabricRenderProfile;
  /** Suggested stretch when this fabric is picked; the owner can change it. */
  defaultStretch?: StretchLevel;
};

export function suggestedStretch(fabric: FabricId): StretchLevel {
  return FABRICS[fabric].defaultStretch ?? 'none';
}

export const FABRICS: Record<FabricId, FabricInfo> = {
  cotton: {
    id: 'cotton',
    label: 'قطن',
    description: 'مطفي وناعم، مناسب للاستخدام اليومي',
    render: { roughness: 0.92, sheen: 0.25, sheenRoughness: 0.8, clearcoat: 0, opacity: 1, pattern: 'weave', patternRepeat: 40, bumpScale: 0.6 },
  },
  linen: {
    id: 'linen',
    label: 'كتان',
    description: 'نسيج خشن قليلًا وظاهر الحبكة',
    render: { roughness: 0.96, sheen: 0.15, sheenRoughness: 0.9, clearcoat: 0, opacity: 1, pattern: 'weave', patternRepeat: 24, bumpScale: 1.4 },
  },
  wool: {
    id: 'wool',
    label: 'صوف',
    description: 'سطح ليفي دافئ بلمعة خفيفة جدًا',
    render: { roughness: 1, sheen: 0.6, sheenRoughness: 0.9, clearcoat: 0, opacity: 1, pattern: 'pile', patternRepeat: 30, bumpScale: 1.2 },
  },
  silk: {
    id: 'silk',
    label: 'حرير',
    description: 'لامع وناعم الملمس',
    render: { roughness: 0.38, sheen: 1, sheenRoughness: 0.3, clearcoat: 0.1, opacity: 1, pattern: 'plain', patternRepeat: 60, bumpScale: 0.15 },
  },
  satin: {
    id: 'satin',
    label: 'ساتان',
    description: 'لمعة قوية على وجه القماش',
    render: { roughness: 0.28, sheen: 0.9, sheenRoughness: 0.25, clearcoat: 0.35, opacity: 1, pattern: 'plain', patternRepeat: 60, bumpScale: 0.1 },
  },
  denim: {
    id: 'denim',
    label: 'جينز (دنيم)',
    description: 'قماش متين بحبكة مائلة',
    render: { roughness: 0.88, sheen: 0.2, sheenRoughness: 0.8, clearcoat: 0, opacity: 1, pattern: 'twill', patternRepeat: 36, bumpScale: 1.6 },
  },
  polyester: {
    id: 'polyester',
    defaultStretch: 'some',
    label: 'بوليستر',
    description: 'صناعي بلمعة متوسطة',
    render: { roughness: 0.6, sheen: 0.4, sheenRoughness: 0.5, clearcoat: 0.05, opacity: 1, pattern: 'plain', patternRepeat: 50, bumpScale: 0.3 },
  },
  chiffon: {
    id: 'chiffon',
    label: 'شيفون',
    description: 'خفيف وشبه شفاف',
    render: { roughness: 0.7, sheen: 0.7, sheenRoughness: 0.4, clearcoat: 0, opacity: 0.78, pattern: 'weave', patternRepeat: 70, bumpScale: 0.2 },
  },
  velvet: {
    id: 'velvet',
    label: 'مخمل',
    description: 'وبر كثيف ولمعة على الحواف',
    render: { roughness: 1, sheen: 1, sheenRoughness: 0.75, clearcoat: 0, opacity: 1, pattern: 'pile', patternRepeat: 50, bumpScale: 0.5 },
  },
  leather: {
    id: 'leather',
    label: 'جلد',
    description: 'سطح محبب بلمعة ناعمة',
    render: { roughness: 0.5, sheen: 0, sheenRoughness: 0.5, clearcoat: 0.45, opacity: 1, pattern: 'grain', patternRepeat: 18, bumpScale: 1.1 },
  },
  knit: {
    id: 'knit',
    defaultStretch: 'high',
    label: 'تريكو (محبوك)',
    description: 'نسيج محبوك مرن بغرز ظاهرة',
    render: { roughness: 0.95, sheen: 0.45, sheenRoughness: 0.8, clearcoat: 0, opacity: 1, pattern: 'knit', patternRepeat: 22, bumpScale: 1.8 },
  },
  other: {
    id: 'other',
    label: 'أخرى',
    description: 'حدّد اسم القماش يدويًا',
    render: { roughness: 0.8, sheen: 0.3, sheenRoughness: 0.7, clearcoat: 0, opacity: 1, pattern: 'plain', patternRepeat: 40, bumpScale: 0.3 },
  },
};

export function fabricDisplayName(fabric: FabricId, note: string): string {
  return fabric === 'other' && note.trim() ? note.trim() : FABRICS[fabric].label;
}
