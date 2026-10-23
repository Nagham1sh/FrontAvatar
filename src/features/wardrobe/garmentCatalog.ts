import { CLOTHING_SIZES } from '../../components/clothing/clothingSizes';
import type { FitType, GarmentType, MeasurementKey, ModelRef, StretchLevel } from './types';

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

/**
 * How each garment measurement is taken, worded after the tailor interview.
 * `circumference` measurements can be entered as a flat width (garment laid
 * flat = half the circumference) and are then doubled.
 */
export const MEASUREMENT_LABELS: Record<MeasurementKey, { label: string; hint: string; circumference: boolean }> = {
  chest: {
    label: 'محيط الصدر',
    hint: 'عند أعرض منطقة في الصدر. القطعة مفرودة: من إبط إلى إبط × 2',
    circumference: true,
  },
  waist: {
    label: 'محيط الخصر',
    hint: 'عند أضيق منطقة في الخصر. القطعة مفرودة: العرض × 2',
    circumference: true,
  },
  hips: {
    label: 'محيط الورك',
    hint: 'عند أعرض منطقة عند الأرداف. القطعة مفرودة: العرض × 2',
    circumference: true,
  },
  shoulder: {
    label: 'عرض الأكتاف',
    hint: 'خط مستقيم من نهاية الكتف إلى نهاية الكتف الآخر',
    circumference: false,
  },
  length: {
    label: 'طول القطعة',
    hint: 'من أعلى الكتف (أو من الخصر للبنطلون والتنورة) حتى الحافة السفلية',
    circumference: false,
  },
  sleeveLength: {
    label: 'طول الكم',
    hint: 'من نهاية الكتف حتى نهاية الكم',
    circumference: false,
  },
  neck: {
    label: 'محيط فتحة الرقبة',
    hint: 'محيط فتحة الرقبة أو الياقة؛ يجب أن تكون مريحة ولا تضايق',
    circumference: true,
  },
  armhole: {
    label: 'محيط فتحة الإبط',
    hint: 'محيط فتحة الكم عند الإبط؛ الفتحة الضيقة تعيق حركة الذراع',
    circumference: true,
  },
  inseam: {
    label: 'طول الرجل الداخلي',
    hint: 'من منطقة التقاء الساقين حتى أسفل الساق',
    circumference: false,
  },
  thigh: {
    label: 'محيط الفخذ',
    hint: 'حول الساق عند أعلى الفخذ. القطعة مفرودة: العرض × 2',
    circumference: true,
  },
  legOpening: {
    label: 'محيط فتحة الساق',
    hint: 'حول الساق عند الحافة السفلية. القطعة مفرودة: العرض × 2',
    circumference: true,
  },
};

export type MeasurementField = { key: MeasurementKey; required: boolean };

/**
 * Which garment measurements apply to each type (required ones first).
 * Following the tailor: chest, waist, hips, shoulder width and the lengths
 * matter for dresses and shirts; trousers depend on waist, hips and leg length.
 */
export const MEASUREMENTS_BY_TYPE: Record<GarmentType, MeasurementField[]> = {
  tshirt: [
    { key: 'chest', required: true },
    { key: 'length', required: true },
    { key: 'shoulder', required: false },
    { key: 'waist', required: false },
    { key: 'sleeveLength', required: false },
    { key: 'armhole', required: false },
  ],
  shirt: [
    { key: 'chest', required: true },
    { key: 'shoulder', required: true },
    { key: 'length', required: true },
    { key: 'waist', required: false },
    { key: 'hips', required: false },
    { key: 'sleeveLength', required: false },
    { key: 'neck', required: false },
    { key: 'armhole', required: false },
  ],
  jacket: [
    { key: 'chest', required: true },
    { key: 'shoulder', required: true },
    { key: 'length', required: true },
    { key: 'sleeveLength', required: false },
    { key: 'waist', required: false },
    { key: 'hips', required: false },
    { key: 'armhole', required: false },
  ],
  dress: [
    { key: 'chest', required: true },
    { key: 'waist', required: true },
    { key: 'hips', required: true },
    { key: 'length', required: true },
    { key: 'shoulder', required: false },
    { key: 'sleeveLength', required: false },
    { key: 'neck', required: false },
    { key: 'armhole', required: false },
  ],
  pants: [
    { key: 'waist', required: true },
    { key: 'hips', required: true },
    { key: 'inseam', required: true },
    { key: 'length', required: true },
    { key: 'thigh', required: false },
    { key: 'legOpening', required: false },
  ],
  skirt: [
    { key: 'waist', required: true },
    { key: 'hips', required: true },
    { key: 'length', required: true },
  ],
};

/** A flat-laid garment shows half its circumference. */
export function flatToCircumference(flatWidth: number): number {
  return Math.round(flatWidth * 2 * 10) / 10;
}

export function circumferenceToFlat(circumference: number): number {
  return Math.round((circumference / 2) * 10) / 10;
}

export const FIT_LABELS: Record<FitType, { label: string; hint: string }> = {
  slim: { label: 'ضيقة', hint: 'قريبة من الجسم وبزيادة قليلة' },
  regular: { label: 'عادية', hint: 'زيادة متوسطة مريحة للحركة' },
  loose: { label: 'واسعة', hint: 'زيادة كبيرة ومساحة واضحة حول الجسم' },
};

export const STRETCH_LABELS: Record<StretchLevel, { label: string; hint: string }> = {
  none: { label: 'غير مطاطي', hint: 'لا يتمدد؛ يحتاج مجالًا أكبر للراحة والحركة' },
  some: { label: 'مطاطي قليلًا', hint: 'يتمدد بشكل بسيط' },
  high: { label: 'مطاطي', hint: 'يتمدد ويسمح بحركة أكثر' },
};

/** Measuring rules from the tailor interview, shown in the product form. */
export const MEASURING_TIPS: string[] = [
  'افرد القطعة على سطح مستوٍ، وقِس بهدوء دون شد القماش أو تغيير شكله، خاصة إذا كان فيها طيّات أو انحناءات.',
  'أبقِ المتر مستقيمًا: لا تشدّه كثيرًا ولا ترخِه.',
  'عند قياس القطعة وهي مفرودة يظهر نصف المحيط فقط، فاضرب العرض × 2 (أو اختر «العرض المسطّح» ليحسبه النظام).',
  'قِس القطعة عند المناطق نفسها التي يُقاس عندها الجسم (الصدر والخصر والورك) حتى تصح المقارنة.',
  'حدّد نوع القصّة ومرونة القماش: القماش غير المطاطي يحتاج زيادة أكبر للحركة.',
];

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
