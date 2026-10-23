import { GARMENT_TYPE_LABELS, MEASUREMENTS_BY_TYPE, MEASUREMENT_LABELS, flatToCircumference } from './garmentCatalog';
import { FABRIC_IDS, FIT_TYPES, GARMENT_TYPES, SIZE_LABELS, STRETCH_LEVELS } from './types';
import type { GarmentMeasurements, ProductDraft, SizeLabel } from './types';

/**
 * Field path -> Arabic error message. Paths:
 *   name, type, fabric, fabricNote, color, description, images.front,
 *   sizes, measurements.<SIZE>.<key>, extra.price
 */
export type ValidationErrors = Record<string, string>;

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 1000;
export const MEASUREMENT_MIN_CM = 5;
export const MEASUREMENT_MAX_CM = 300;

export function measurementErrorKey(size: SizeLabel, key: string): string {
  return `measurements.${size}.${key}`;
}

/**
 * Drops measurements that no longer apply (unselected sizes, keys that do not
 * belong to the garment type) so stale values are never saved or exported.
 */
export function normalizeDraft(draft: ProductDraft): ProductDraft {
  const allowedKeys = MEASUREMENTS_BY_TYPE[draft.type].map((f) => f.key);
  const sizes = SIZE_LABELS.filter((s) => draft.sizes.includes(s));
  const measurements: ProductDraft['measurements'] = {};

  for (const size of sizes) {
    const source = draft.measurements[size] ?? {};
    const cleaned: GarmentMeasurements = {};
    for (const key of allowedKeys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) cleaned[key] = value;
    }
    measurements[size] = cleaned;
  }

  return {
    ...draft,
    name: draft.name.trim(),
    fabricNote: draft.fabric === 'other' ? draft.fabricNote.trim() : '',
    description: draft.description.trim(),
    sizes,
    measurements,
    extra: { ...draft.extra, sku: draft.extra.sku.trim(), notes: draft.extra.notes.trim() },
  };
}

export function validateProductDraft(draft: ProductDraft): ValidationErrors {
  const errors: ValidationErrors = {};
  const name = draft.name.trim();

  // The name is generated on save («فستان 3»), so an empty name is fine here.
  if (name.length > NAME_MAX) errors.name = `اسم القطعة طويل جدًا (الحد الأقصى ${NAME_MAX} حرفًا).`;

  if (!GARMENT_TYPES.includes(draft.type)) errors.type = 'اختر نوع القطعة.';

  if (!FABRIC_IDS.includes(draft.fabric)) errors.fabric = 'اختر نوع القماش.';
  else if (draft.fabric === 'other' && !draft.fabricNote.trim()) {
    errors.fabricNote = 'اكتب اسم القماش عند اختيار «أخرى».';
  }

  if (!STRETCH_LEVELS.includes(draft.stretch)) errors.stretch = 'حدّد مرونة القماش.';
  if (!FIT_TYPES.includes(draft.fit)) errors.fit = 'حدّد نوع القصّة.';

  if (!/^#[0-9a-f]{6}$/i.test(draft.color)) errors.color = 'اللون غير صالح.';

  if (draft.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `الوصف طويل جدًا (الحد الأقصى ${DESCRIPTION_MAX} حرف).`;
  }

  if (!draft.images.front) errors['images.front'] = 'صورة القطعة من الأمام مطلوبة.';

  if (draft.sizes.length === 0) {
    errors.sizes = 'اختر مقاسًا واحدًا متوفرًا على الأقل.';
  } else if (GARMENT_TYPES.includes(draft.type)) {
    const fields = MEASUREMENTS_BY_TYPE[draft.type];
    for (const size of draft.sizes) {
      const values = draft.measurements[size] ?? {};
      for (const field of fields) {
        const value = values[field.key];
        const key = measurementErrorKey(size, field.key);
        const label = MEASUREMENT_LABELS[field.key].label;

        if (value === undefined || value === null || Number.isNaN(value)) {
          if (field.required) errors[key] = `${label} مطلوب للمقاس ${size}.`;
        } else if (value < MEASUREMENT_MIN_CM || value > MEASUREMENT_MAX_CM) {
          errors[key] = `${label} للمقاس ${size} يجب أن يكون بين ${MEASUREMENT_MIN_CM} و${MEASUREMENT_MAX_CM} سم.`;
        }
      }
    }
  }

  const price = draft.extra.price;
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    errors['extra.price'] = 'السعر يجب أن يكون رقمًا موجبًا.';
  }

  return errors;
}

/** Below this a chest / waist / hip circumference is almost certainly a flat width. */
const FLAT_WIDTH_SUSPECT_CM = 50;

/**
 * Non-blocking checks for the measuring mistakes the tailor named: a flat
 * width entered as a circumference, hips narrower than the waist, and sizes
 * whose measurements go down as the size goes up.
 */
export function measurementWarnings(draft: ProductDraft): string[] {
  const warnings: string[] = [];
  if (!GARMENT_TYPES.includes(draft.type)) return warnings;
  const fields = MEASUREMENTS_BY_TYPE[draft.type].map((f) => f.key);
  const sizes = SIZE_LABELS.filter((s) => draft.sizes.includes(s));

  for (const size of sizes) {
    const m = draft.measurements[size] ?? {};
    for (const key of ['chest', 'waist', 'hips'] as const) {
      const value = m[key];
      if (fields.includes(key) && typeof value === 'number' && value > 0 && value < FLAT_WIDTH_SUSPECT_CM) {
        warnings.push(
          `${MEASUREMENT_LABELS[key].label} للمقاس ${size} = ${value} سم يبدو عرضًا مسطّحًا (نصف المحيط). هل المقصود ${flatToCircumference(value)} سم؟`,
        );
      }
    }
    if (
      fields.includes('hips') &&
      draft.type !== 'tshirt' &&
      typeof m.waist === 'number' &&
      typeof m.hips === 'number' &&
      m.hips < m.waist
    ) {
      warnings.push(`في المقاس ${size} محيط الورك (${m.hips}) أصغر من محيط الخصر (${m.waist}). تأكد من مكان القياس.`);
    }
  }

  for (const key of ['chest', 'waist', 'hips'] as const) {
    for (let i = 1; i < sizes.length; i++) {
      const smaller = draft.measurements[sizes[i - 1]]?.[key];
      const larger = draft.measurements[sizes[i]]?.[key];
      if (fields.includes(key) && typeof smaller === 'number' && typeof larger === 'number' && larger < smaller) {
        warnings.push(
          `${MEASUREMENT_LABELS[key].label}: المقاس ${sizes[i]} (${larger}) أصغر من المقاس ${sizes[i - 1]} (${smaller}).`,
        );
      }
    }
  }
  return warnings;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Human readable summary used by the export check. */
export function describeErrors(errors: ValidationErrors, limit = 4): string[] {
  const messages = Object.values(errors);
  if (messages.length <= limit) return messages;
  return [...messages.slice(0, limit), `و${messages.length - limit} ملاحظات أخرى.`];
}

export function typeLabel(type: ProductDraft['type']): string {
  return GARMENT_TYPE_LABELS[type] ?? type;
}
