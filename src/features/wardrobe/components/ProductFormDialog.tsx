import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { suggestedStretch } from '../fabrics';
import { FIT_LABELS, GARMENT_TYPE_LABELS, SAMPLE_MEASUREMENTS, STRETCH_LABELS } from '../garmentCatalog';
import { DESCRIPTION_MAX, hasErrors, measurementWarnings, validateProductDraft } from '../validation';
import type { ValidationErrors } from '../validation';
import { FIT_TYPES, GARMENT_TYPES, STRETCH_LEVELS, completeDraft, draftFromProduct, emptyDraft } from '../types';
import type { ClothingProduct, GarmentMeasurements, ProductDraft, SizeLabel } from '../types';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { storageErrorMessage } from '../useProducts';
import { estimateGarmentColor } from '../viewer/photoTexture';
import { FabricPicker, Field, FieldError, ImageField, MeasurementsEditor, ModelField } from './FormControls';

type ProductFormDialogProps = {
  /** null = closed, 'new' = create, product = edit. */
  target: ClothingProduct | 'new' | null;
  onClose: () => void;
  onSubmit: (draft: ProductDraft, existing: ClothingProduct | null) => Promise<void>;
};

export function ProductFormDialog({ target, onClose, onSubmit }: ProductFormDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [rawDraft, setDraft] = useState<ProductDraft>(emptyDraft);
  // Render from a completed copy: even state kept by a tab across an app update renders safely.
  const draft = useMemo(() => completeDraft(rawDraft), [rawDraft]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  /** Until the owner picks a colour, it follows the front photo. */
  const [colorTouched, setColorTouched] = useState(false);
  /** Until the owner picks a stretch level, it follows the chosen fabric. */
  const [stretchTouched, setStretchTouched] = useState(false);
  const existing = target && target !== 'new' ? target : null;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (target) {
      setDraft(existing ? draftFromProduct(existing) : emptyDraft());
      setErrors({});
      setSubmitted(false);
      setSaveError(undefined);
      setColorTouched(Boolean(existing));
      setStretchTouched(Boolean(existing));
      if (!el.open) el.showModal();
      form.current?.scrollTo({ top: 0 });
      requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>('input[name="garment-type"]:checked')?.focus());
    } else if (el.open) {
      el.close();
    }
  }, [target, existing]);

  // After the first submit attempt, re-validate live so errors disappear as they are fixed.
  useEffect(() => {
    if (submitted) setErrors(validateProductDraft(draft));
  }, [draft, submitted]);

  /** Functional form keeps async updates (image processing) from overwriting newer edits. */
  function patch(update: Partial<ProductDraft> | ((current: ProductDraft) => Partial<ProductDraft>)) {
    setDraft((current) => completeDraft({ ...current, ...(typeof update === 'function' ? update(current) : update) }));
  }

  function setMeasurement(size: SizeLabel, key: keyof GarmentMeasurements, value: number | undefined) {
    patch((current) => ({
      measurements: {
        ...current.measurements,
        [size]: { ...current.measurements[size], [key]: value },
      },
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const found = validateProductDraft(draft);
    setErrors(found);

    if (hasErrors(found)) {
      const firstKey = Object.keys(found)[0];
      requestAnimationFrame(() => {
        const el = form.current?.querySelector<HTMLElement>(
          `[data-error-key="${firstKey}"], [aria-invalid="true"]`,
        );
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el?.matches('input, select, textarea') ? el : el?.querySelector<HTMLElement>('input, button'))?.focus();
      });
      return;
    }

    setSaving(true);
    setSaveError(undefined);
    try {
      await onSubmit(draft, existing);
    } catch (err) {
      console.error(err);
      setSaveError(storageErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const errorCount = Object.keys(errors).length;

  return (
    <dialog
      ref={dialog}
      className="wd-dialog wd-dialog--wide"
      aria-labelledby="product-form-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <ErrorBoundary key={existing?.id ?? String(target)} title="حدث خطأ في نموذج القطعة">
      <form ref={form} className="wd-dialog__body" onSubmit={handleSubmit} noValidate>
        <header className="wd-dialog__header">
          <h2 id="product-form-title">{existing ? `تعديل: ${existing.name}` : 'إضافة قطعة ملابس جديدة'}</h2>
          <button type="button" className="wd-icon-btn" aria-label="إغلاق" onClick={onClose} disabled={saving}>
            ✕
          </button>
        </header>

        {errorCount > 0 && (
          <div className="wd-alert wd-alert--error" role="alert">
            يرجى تصحيح {errorCount === 1 ? 'حقل واحد' : `${errorCount} حقول`} قبل الحفظ.
          </div>
        )}

        <section className="wd-form-section">
          <h3>نوع القطعة</h3>
          <div className="wd-type-grid" role="radiogroup" aria-label="نوع القطعة" data-error-key="type">
            {GARMENT_TYPES.map((t) => (
              <label key={t} className={`wd-type${draft.type === t ? ' wd-type--active' : ''}`}>
                <input
                  type="radio"
                  name="garment-type"
                  className="wd-visually-hidden"
                  value={t}
                  checked={draft.type === t}
                  onChange={() => patch({ type: t })}
                />
                {GARMENT_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          <FieldError id="type-error" message={errors.type} />
          <p className="wd-hint">
            {existing
              ? `اسم القطعة: ${existing.name}`
              : 'لا حاجة لكتابة اسم: تُسمّى القطعة تلقائيًا حسب نوعها، مثل «فستان 1». بعد اختيار النوع تظهر قياساته المهمة مباشرة.'}
          </p>
        </section>

        <section className="wd-form-section">
          <h3>القياسات المهمة — {GARMENT_TYPE_LABELS[draft.type]}</h3>
          <MeasurementsEditor
            type={draft.type}
            sizes={draft.sizes}
            measurements={draft.measurements}
            errors={errors}
            warnings={measurementWarnings(draft)}
            onSizesChange={(sizes) => patch({ sizes })}
            onFillSample={() =>
              patch((current) => ({
                sizes: ['S', 'M', 'L'],
                measurements: structuredClone(SAMPLE_MEASUREMENTS[current.type]),
              }))
            }
            onMeasurementChange={setMeasurement}
          />
        </section>

        <section className="wd-form-section">
          <h3>الصور</h3>
          <div className="wd-grid-2">
            <ImageField
              label="الصورة الأمامية"
              required
              value={draft.images.front}
              error={errors['images.front']}
              errorKey="images.front"
              onChange={async (front) => {
                const color = front && !colorTouched ? await estimateGarmentColor(front) : null;
                patch((current) => ({ images: { ...current.images, front }, ...(color ? { color } : {}) }));
              }}
            />
            <ImageField
              label="الصورة الخلفية"
              value={draft.images.back}
              errorKey="images.back"
              onChange={(back) => patch((current) => ({ images: { ...current.images, back } }))}
            />
          </div>
        </section>

        <section className="wd-form-section">
          <h3>القماش واللون</h3>
          <div data-error-key="fabric">
            <FabricPicker
              value={draft.fabric}
              onChange={(fabric) => patch(stretchTouched ? { fabric } : { fabric, stretch: suggestedStretch(fabric) })}
            />
            <FieldError id="fabric-error" message={errors.fabric} />
          </div>
          <div className="wd-grid-2">
            {draft.fabric === 'other' && (
              <Field label="اسم القماش" required error={errors.fabricNote}>
                {({ inputId, describedBy, invalid }) => (
                  <input
                    id={inputId}
                    className="wd-input"
                    value={draft.fabricNote}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    data-error-key="fabricNote"
                    onChange={(e) => patch({ fabricNote: e.target.value })}
                  />
                )}
              </Field>
            )}
            <Field
              label="اللون الأساسي"
              hint={colorTouched ? 'يُستخدم لتلوين المعاينة ثلاثية الأبعاد' : 'يُقترح تلقائيًا من الصورة الأمامية ويمكن تغييره'}
              error={errors.color}
            >
              {({ inputId, describedBy }) => (
                <div className="wd-row">
                  <input
                    id={inputId}
                    type="color"
                    className="wd-color"
                    value={draft.color}
                    aria-describedby={describedBy}
                    onChange={(e) => {
                      setColorTouched(true);
                      patch({ color: e.target.value });
                    }}
                  />
                  <code dir="ltr">{draft.color}</code>
                </div>
              )}
            </Field>
          </div>
          <div className="wd-grid-2">
            <div className="wd-field" data-error-key="stretch">
              <span className="wd-field__label">مرونة القماش</span>
              <div className="wd-segmented" role="group" aria-label="مرونة القماش">
                {STRETCH_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={draft.stretch === level}
                    title={STRETCH_LABELS[level].hint}
                    onClick={() => {
                      setStretchTouched(true);
                      patch({ stretch: level });
                    }}
                  >
                    {STRETCH_LABELS[level].label}
                  </button>
                ))}
              </div>
              <p className="wd-hint">{STRETCH_LABELS[draft.stretch].hint}</p>
              <FieldError id="stretch-error" message={errors.stretch} />
            </div>
            <div className="wd-field" data-error-key="fit">
              <span className="wd-field__label">نوع القصّة</span>
              <div className="wd-segmented" role="group" aria-label="نوع القصّة">
                {FIT_TYPES.map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    aria-pressed={draft.fit === fit}
                    title={FIT_LABELS[fit].hint}
                    onClick={() => patch({ fit })}
                  >
                    {FIT_LABELS[fit].label}
                  </button>
                ))}
              </div>
              <p className="wd-hint">{FIT_LABELS[draft.fit].hint}</p>
              <FieldError id="fit-error" message={errors.fit} />
            </div>
          </div>
          <p className="wd-hint">
            نوع القماش ومرونته ونوع القصّة تُحفظ مع المنتج وتُرسل إلى غرفة القياس، لأن الزيادة المناسبة على قياس الجسم
            تعتمد عليها. في العارض يتغيّر مظهر السطح فقط (اللمعة والخشونة والنسيج) — لا توجد محاكاة فيزيائية لحركة القماش.
          </p>
        </section>

        <section className="wd-form-section">
          <h3>النموذج ثلاثي الأبعاد (اختياري)</h3>
          <ModelField value={draft.model} onChange={(model) => patch({ model })} />
        </section>

        <section className="wd-form-section">
          <h3>معلومات إضافية</h3>
          <Field label="وصف القطعة" hint={`${draft.description.length} / ${DESCRIPTION_MAX}`} error={errors.description}>
            {({ inputId, describedBy, invalid }) => (
              <textarea
                id={inputId}
                className="wd-input"
                rows={3}
                value={draft.description}
                placeholder="تفاصيل التصميم، القصّة، طريقة العناية…"
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(e) => patch({ description: e.target.value })}
              />
            )}
          </Field>
          <div className="wd-grid-2">
            <Field label="السعر (₪)" error={errors['extra.price']}>
              {({ inputId, describedBy, invalid }) => (
                <input
                  id={inputId}
                  className="wd-input"
                  type="number"
                  min={0}
                  step="0.5"
                  dir="ltr"
                  value={draft.extra.price ?? ''}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  data-error-key="extra.price"
                  onChange={(e) => {
                    const price = e.target.value === '' ? null : Number(e.target.value);
                    patch((current) => ({ extra: { ...current.extra, price } }));
                  }}
                />
              )}
            </Field>
            <Field label="رمز المنتج (SKU)">
              {({ inputId }) => (
                <input
                  id={inputId}
                  className="wd-input"
                  dir="ltr"
                  value={draft.extra.sku}
                  onChange={(e) => {
                    const sku = e.target.value;
                    patch((current) => ({ extra: { ...current.extra, sku } }));
                  }}
                />
              )}
            </Field>
          </div>
          <Field label="ملاحظات">
            {({ inputId }) => (
              <textarea
                id={inputId}
                className="wd-input"
                rows={2}
                value={draft.extra.notes}
                placeholder="تعليمات الغسيل، بلد الصنع…"
                onChange={(e) => {
                  const notes = e.target.value;
                  patch((current) => ({ extra: { ...current.extra, notes } }));
                }}
              />
            )}
          </Field>
        </section>

        {saveError && (
          <div className="wd-alert wd-alert--error" role="alert">
            {saveError}
          </div>
        )}

        <footer className="wd-dialog__footer">
          <button type="button" className="wd-btn wd-btn--ghost" onClick={onClose} disabled={saving}>
            إلغاء
          </button>
          <button type="submit" className="wd-btn wd-btn--primary" disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : existing ? 'حفظ التعديلات' : 'إضافة القطعة'}
          </button>
        </footer>
      </form>
      </ErrorBoundary>
    </dialog>
  );
}
