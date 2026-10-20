import { CLOTHING_SIZES } from '../../components/clothing/clothingSizes';
import type { GarmentType, MeasurementKey, ModelRef } from './types';

export const GARMENT_TYPE_LABELS: Record<GarmentType, string> = {
  tshirt: 'تيشيرت',
  shirt: 'قميص',
  jacket: 'جاكيت',
  dress: 'فستان',
  pants: 'بنطلون',
  skirt: 'تنورة',
};

export type GarmentCategory = 'top' | 'bottom' | 'full-body';

export const GARMENT_CATEGORY: Record<GarmentType, GarmentCategory> = {
  tshirt: 'top',
  shirt: 'top',
  jacket: 'top',
  dress: 'full-body',
  pants: 'bottom',
  skirt: 'bottom',
};

export const MEASUREMENT_LABELS: Record<MeasurementKey, { label: string; hint: string }> = {
  chest: { label: 'محيط الصدر', hint: 'محيط القطعة عند الصدر (ضعف العرض المسطّح من إبط إلى إبط)' },
  waist: { label: 'محيط الخصر', hint: 'محيط القطعة عند الخصر' },
  hips: { label: 'محيط الأرداف', hint: 'محيط القطعة عند أعرض نقطة في الأرداف' },
  shoulder: { label: 'عرض الأكتاف', hint: 'المسافة بين طرفي الكتفين' },
  length: { label: 'طول القطعة', hint: 'من أعلى نقطة في القطعة حتى الحافة السفلية' },
  sleeveLength: { label: 'طول الكم', hint: 'من طرف الكتف حتى نهاية الكم' },
  neck: { label: 'محيط الياقة', hint: 'محيط فتحة الرقبة أو الياقة' },
  inseam: { label: 'الطول الداخلي', hint: 'من منطقة التقاء الساقين حتى أسفل الساق' },
  thigh: { label: 'محيط الفخذ', hint: 'محيط الساق عند أعلى الفخذ' },
  legOpening: { label: 'محيط فتحة الساق', hint: 'محيط الساق عند الحافة السفلية' },
};

export type MeasurementField = { key: MeasurementKey; required: boolean };

/** Which garment measurements apply to each type (required ones first). */
export const MEASUREMENTS_BY_TYPE: Record<GarmentType, MeasurementField[]> = {
  tshirt: [
    { key: 'chest', required: true },
    { key: 'length', required: true },
    { key: 'shoulder', required: false },
    { key: 'waist', required: false },
    { key: 'sleeveLength', required: false },
  ],
  shirt: [
    { key: 'chest', required: true },
    { key: 'length', required: true },
    { key: 'shoulder', required: false },
    { key: 'sleeveLength', required: false },
    { key: 'waist', required: false },
    { key: 'neck', required: false },
  ],
  jacket: [
    { key: 'chest', required: true },
    { key: 'length', required: true },
    { key: 'shoulder', required: false },
    { key: 'sleeveLength', required: false },
    { key: 'waist', required: false },
  ],
  dress: [
    { key: 'chest', required: true },
    { key: 'waist', required: true },
    { key: 'length', required: true },
    { key: 'hips', required: false },
    { key: 'shoulder', required: false },
  ],
  pants: [
    { key: 'waist', required: true },
    { key: 'hips', required: true },
    { key: 'length', required: true },
    { key: 'inseam', required: false },
    { key: 'thigh', required: false },
    { key: 'legOpening', required: false },
  ],
  skirt: [
    { key: 'waist', required: true },
    { key: 'length', required: true },
    { key: 'hips', required: false },
  ],
};

/**
 * 3D garment models that already exist in the repository (public/models),
 * taken from the clothing size table instead of hard-coding paths twice.
 */
export const PROJECT_MODELS: Extract<ModelRef, { kind: 'project' }>[] = Object.values(
  CLOTHING_SIZES,
).map((info) => ({
  kind: 'project',
  url: info.model,
  label: `نموذج المشروع — مقاس ${info.label} (${info.model.split('/').pop()})`,
}));
