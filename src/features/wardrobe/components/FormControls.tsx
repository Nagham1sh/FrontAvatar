import { useId, useState } from 'react';
import type { ClipboardEvent, DragEvent, ReactNode } from 'react';
import { FABRICS } from '../fabrics';
import { FileProcessingError, formatBytes, imageFileToDataUrl, modelFileToDataUrl } from '../fileProcessing';
import { MEASUREMENTS_BY_TYPE, MEASUREMENT_LABELS, MEASURING_TIPS, PROJECT_MODELS } from '../garmentCatalog';
import { measurementErrorKey } from '../validation';
import type { ValidationErrors } from '../validation';
import { FABRIC_IDS, SIZE_LABELS } from '../types';
import type { FabricId, GarmentMeasurements, GarmentType, ModelRef, SizeLabel } from '../types';

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="wd-field__error" role="alert">
      {message}
    </p>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: (ids: { inputId: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

export function Field({ label, required, hint, error, children }: FieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="wd-field">
      <label htmlFor={inputId} className="wd-field__label">
        {label}
        {required && <span className="wd-required" aria-hidden="true"> *</span>}
      </label>
      {children({ inputId, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="wd-hint">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

/* ---------- Image picker ---------- */

type ImageFieldProps = {
  label: string;
  required?: boolean;
  value: string | null;
  error?: string;
  errorKey: string;
  onChange: (dataUrl: string | null) => void;
};

export function ImageField({ label, required, value, error, errorKey, onChange }: ImageFieldProps) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const shownError = localError ?? error;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setLocalError(undefined);
    try {
      onChange(await imageFileToDataUrl(file));
    } catch (err) {
      setLocalError(err instanceof FileProcessingError ? err.message : 'تعذّر تحميل الصورة.');
    } finally {
      setBusy(false);
    }
  }

  // Besides the system file picker, a photo can be dropped on the box or pasted into it.
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
    else setLocalError('لم يتم إفلات ملف. اسحب صورة من مجلد على جهازك.');
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (!file) {
      setLocalError('لا توجد صورة في الحافظة. انسخ صورة أولًا ثم الصقها هنا.');
      return;
    }
    e.preventDefault();
    void handleFile(file);
  }

  return (
    <div className="wd-field" data-error-key={errorKey}>
      <span className="wd-field__label">
        {label}
        {required && <span className="wd-required" aria-hidden="true"> *</span>}
      </span>
      <div
        className={`wd-image-field${shownError ? ' wd-image-field--invalid' : ''}${dragging ? ' wd-image-field--dragging' : ''}`}
        tabIndex={0}
        role="group"
        aria-label={`${label}: اسحب صورة إلى هنا أو الصقها بـ Ctrl+V`}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        {value ? (
          <img src={value} alt={label} />
        ) : (
          <span className="wd-image-field__empty">
            {busy ? 'جارٍ المعالجة…' : dragging ? 'أفلت الصورة هنا' : 'اسحب صورة إلى هنا، أو اضغط هنا ثم الصق (Ctrl+V)'}
          </span>
        )}
      </div>
      <div className="wd-row">
        <label htmlFor={inputId} className="wd-btn wd-btn--small wd-btn--ghost">
          {value ? 'تغيير الصورة' : 'اختيار صورة'}
        </label>
        <input
          id={inputId}
          className="wd-visually-hidden"
          type="file"
          accept="image/*"
          aria-invalid={Boolean(shownError)}
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {value && (
          <button type="button" className="wd-btn wd-btn--small wd-btn--text" onClick={() => onChange(null)}>
            إزالة
          </button>
        )}
      </div>
      <FieldError id={`${inputId}-error`} message={shownError} />
    </div>
  );
}

/* ---------- Fabric picker ---------- */

export function FabricPicker({ value, onChange }: { value: FabricId; onChange: (fabric: FabricId) => void }) {
  return (
    <div className="wd-fabric-grid" role="radiogroup" aria-label="نوع القماش">
      {FABRIC_IDS.map((id) => (
        <label key={id} className={`wd-fabric${value === id ? ' wd-fabric--active' : ''}`}>
          <input
            type="radio"
            name="fabric"
            value={id}
            checked={value === id}
            onChange={() => onChange(id)}
            className="wd-visually-hidden"
          />
          <span className={`wd-fabric__swatch wd-fabric__swatch--${FABRICS[id].render.pattern}`} aria-hidden="true" />
          <span className="wd-fabric__name">{FABRICS[id].label}</span>
          <span className="wd-fabric__desc">{FABRICS[id].description}</span>
        </label>
      ))}
    </div>
  );
}

/* ---------- Sizes + per-size garment measurements ---------- */

type MeasurementsEditorProps = {
  type: GarmentType;
  sizes: SizeLabel[];
  measurements: Partial<Record<SizeLabel, GarmentMeasurements>>;
  errors: ValidationErrors;
  warnings: string[];
  onSizesChange: (sizes: SizeLabel[]) => void;
  onMeasurementChange: (size: SizeLabel, key: keyof GarmentMeasurements, value: number | undefined) => void;
  /** Fills sizes S/M/L with sample measurements for the current type. */
  onFillSample: () => void;
};

type EntryMode = 'circumference' | 'flat';

export function MeasurementsEditor({
  type,
  sizes,
  measurements,
  errors,
  warnings,
  onSizesChange,
  onMeasurementChange,
  onFillSample,
}: MeasurementsEditorProps) {
  const fields = MEASUREMENTS_BY_TYPE[type];
  const ordered = SIZE_LABELS.filter((s) => sizes.includes(s));
  // A garment laid flat shows half of each circumference; in "flat" mode the
  // owner types that width and the stored value is always the full circumference.
  const [mode, setMode] = useState<EntryMode>('circumference');
  const isFlat = (key: keyof GarmentMeasurements) => mode === 'flat' && MEASUREMENT_LABELS[key].circumference;

  // The important (required) measurements come first; optional ones on request,
  // or automatically when one of them already has a value (e.g. when editing).
  const optional = fields.filter((f) => !f.required);
  const [showOptional, setShowOptional] = useState(false);
  const optionalHasValues = optional.some((f) => ordered.some((s) => measurements[s]?.[f.key] !== undefined));
  const optionalOpen = showOptional || optionalHasValues;
  const visibleFields = optionalOpen ? fields : fields.filter((f) => f.required);

  function toggle(size: SizeLabel) {
    onSizesChange(sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size]);
  }

  return (
    <div className="wd-measurements">
      <div className="wd-sample">
        <button type="button" className="wd-btn wd-btn--small wd-btn--ghost" onClick={onFillSample}>
          تعبئة قياسات تجريبية
        </button>
        <span className="wd-hint">
          يملأ المقاسات S وM وL بقياسات افتراضية لهذا النوع للتجربة (يستبدل القياسات الحالية)؛ يبقى عليك إضافة الصورة.
        </span>
      </div>

      <div className="wd-field" data-error-key="sizes">
        <span className="wd-field__label">
          المقاسات المتوفرة<span className="wd-required" aria-hidden="true"> *</span>
        </span>
        <div className="wd-chip-row" role="group" aria-label="المقاسات المتوفرة">
          {SIZE_LABELS.map((size) => (
            <button
              key={size}
              type="button"
              className="wd-chip"
              aria-pressed={sizes.includes(size)}
              onClick={() => toggle(size)}
            >
              {size}
            </button>
          ))}
        </div>
        <FieldError id="sizes-error" message={errors.sizes} />
      </div>

      <div className="wd-note" role="note">
        هذه <strong>قياسات قطعة الملابس نفسها</strong> بالسنتيمتر (وليست قياسات جسم المستخدم). الحقول المعلّمة بـ *
        مطلوبة، ومرّر المؤشر على اسم القياس لمعرفة مكانه.
      </div>

      <details className="wd-tips">
        <summary>طريقة القياس الصحيحة (من خبرة الخياطة)</summary>
        <ul>
          {MEASURING_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <dl>
          {fields.map((f) => (
            <div key={f.key}>
              <dt>{MEASUREMENT_LABELS[f.key].label}</dt>
              <dd>{MEASUREMENT_LABELS[f.key].hint}</dd>
            </div>
          ))}
        </dl>
      </details>

      <div className="wd-field">
        <span className="wd-field__label">طريقة إدخال المحيطات</span>
        <div className="wd-segmented" role="group" aria-label="طريقة إدخال المحيطات">
          <button type="button" aria-pressed={mode === 'circumference'} onClick={() => setMode('circumference')}>
            المحيط الكامل
          </button>
          <button type="button" aria-pressed={mode === 'flat'} onClick={() => setMode('flat')}>
            العرض والقطعة مفرودة (× 2 تلقائيًا)
          </button>
        </div>
        {mode === 'flat' && (
          <p className="wd-hint">
            أدخل العرض كما يظهر والقطعة مفرودة على سطح مستوٍ؛ يُحفظ المحيط الكامل (العرض × 2). الأطوال وعرض الأكتاف
            تُدخل كما هي.
          </p>
        )}
      </div>

      {ordered.length === 0 ? (
        <p className="wd-hint">اختر المقاسات أولًا لإدخال قياسات كل مقاس.</p>
      ) : (
        <div className="wd-table-scroll">
          <table className="wd-table wd-table--inputs">
            <thead>
              <tr>
                <th scope="col">المقاس</th>
                {visibleFields.map((f) => (
                  <th key={f.key} scope="col" title={MEASUREMENT_LABELS[f.key].hint}>
                    {isFlat(f.key) ? MEASUREMENT_LABELS[f.key].label.replace('محيط', 'عرض') : MEASUREMENT_LABELS[f.key].label}
                    {f.required && <span className="wd-required" aria-hidden="true"> *</span>}
                    <small>{isFlat(f.key) ? 'سم، مفرودة' : 'سم'}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered.map((size) => (
                <tr key={size}>
                  <th scope="row">{size}</th>
                  {visibleFields.map((f) => {
                    const key = measurementErrorKey(size, f.key);
                    const value = measurements[size]?.[f.key];
                    const flat = isFlat(f.key);
                    const shown = value === undefined ? '' : flat ? value / 2 : value;
                    return (
                      <td key={f.key} data-error-key={key}>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.5"
                          dir="ltr"
                          aria-label={`${MEASUREMENT_LABELS[f.key].label} — مقاس ${size}`}
                          aria-invalid={Boolean(errors[key])}
                          title={errors[key]}
                          value={shown}
                          onChange={(e) => {
                            const typed = e.target.value === '' ? undefined : Number(e.target.value);
                            onMeasurementChange(size, f.key, typed === undefined ? undefined : flat ? typed * 2 : typed);
                          }}
                        />
                        {flat && value !== undefined && <small className="wd-cell-note">= {value} محيط</small>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ordered.length > 0 && optional.length > 0 && (
        <div className="wd-row">
          {optionalOpen ? (
            !optionalHasValues && (
              <button type="button" className="wd-btn wd-btn--small wd-btn--text" onClick={() => setShowOptional(false)}>
                إخفاء القياسات الإضافية
              </button>
            )
          ) : (
            <button type="button" className="wd-btn wd-btn--small wd-btn--ghost" onClick={() => setShowOptional(true)}>
              + قياسات إضافية (اختيارية): {optional.map((f) => MEASUREMENT_LABELS[f.key].label).join('، ')}
            </button>
          )}
        </div>
      )}

      {ordered.some((size) => fields.some((f) => errors[measurementErrorKey(size, f.key)])) && (
        <ul className="wd-error-list" role="alert">
          {ordered.flatMap((size) =>
            fields
              .map((f) => errors[measurementErrorKey(size, f.key)])
              .filter(Boolean)
              .map((message) => <li key={message}>{message}</li>),
          )}
        </ul>
      )}

      {warnings.length > 0 && (
        <div className="wd-alert wd-alert--warning" role="status">
          <strong>تنبيهات للمراجعة (لا تمنع الحفظ):</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- 3D model source ---------- */

export function ModelField({ value, onChange }: { value: ModelRef | null; onChange: (model: ModelRef | null) => void }) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const source = value?.kind ?? 'none';

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      onChange({ kind: 'upload', dataUrl: await modelFileToDataUrl(file), fileName: file.name, sizeBytes: file.size });
    } catch (err) {
      setError(err instanceof FileProcessingError ? err.message : 'تعذّر تحميل النموذج.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wd-field">
      <div className="wd-segmented" role="group" aria-label="مصدر النموذج ثلاثي الأبعاد">
        <button type="button" aria-pressed={source === 'none'} onClick={() => onChange(null)}>
          بدون نموذج
        </button>
        <button
          type="button"
          aria-pressed={source === 'project'}
          onClick={() => onChange(value?.kind === 'project' ? value : PROJECT_MODELS[0] ?? null)}
          disabled={PROJECT_MODELS.length === 0}
        >
          من نماذج المشروع
        </button>
        <button type="button" aria-pressed={source === 'upload'} onClick={() => document.getElementById(inputId)?.click()}>
          رفع ملف GLB
        </button>
      </div>

      <input
        id={inputId}
        className="wd-visually-hidden"
        type="file"
        accept=".glb,model/gltf-binary"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {value?.kind === 'project' && (
        <select
          className="wd-input"
          aria-label="نموذج المشروع"
          value={value.url}
          onChange={(e) => onChange(PROJECT_MODELS.find((m) => m.url === e.target.value) ?? null)}
        >
          {PROJECT_MODELS.map((m) => (
            <option key={m.url} value={m.url}>
              {m.label}
            </option>
          ))}
        </select>
      )}
      {value?.kind === 'upload' && (
        <p className="wd-hint">
          الملف: <bdi>{value.fileName}</bdi> ({formatBytes(value.sizeBytes)})
        </p>
      )}
      {busy && <p className="wd-hint">جارٍ قراءة النموذج…</p>}
      <FieldError id={`${inputId}-error`} message={error} />
      <p className="wd-hint">
        إذا لم يتوفر نموذج، يعرض النظام معاينة تقريبية مولّدة من نوع القطعة وقياساتها وصورها. لا يتم تحويل الصور إلى
        نموذج ثلاثي الأبعاد حقيقي تلقائيًا.
      </p>
    </div>
  );
}
