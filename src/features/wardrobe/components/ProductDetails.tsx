import { fabricDisplayName } from '../fabrics';
import { FIT_LABELS, GARMENT_TYPE_LABELS, MEASUREMENTS_BY_TYPE, MEASUREMENT_LABELS, STRETCH_LABELS } from '../garmentCatalog';
import type { ClothingProduct, SizeLabel } from '../types';
import { ClothingViewer } from '../viewer/ClothingViewer';

type ProductDetailsProps = {
  product: ClothingProduct;
  size: SizeLabel | null;
  exporting: boolean;
  onSizeChange: (size: SizeLabel) => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onDownload: () => void;
};

export function ProductDetails({
  product,
  size,
  exporting,
  onSizeChange,
  onEdit,
  onDelete,
  onExport,
  onDownload,
}: ProductDetailsProps) {
  const fields = MEASUREMENTS_BY_TYPE[product.type];

  return (
    <div className="wd-details">
      <header className="wd-details__header">
        <div>
          <p className="wd-eyebrow">{GARMENT_TYPE_LABELS[product.type]}</p>
          <h2>{product.name}</h2>
        </div>
        <div className="wd-row">
          <button type="button" className="wd-btn wd-btn--small wd-btn--ghost" onClick={onEdit}>
            تعديل
          </button>
          <button type="button" className="wd-btn wd-btn--small wd-btn--danger-ghost" onClick={onDelete}>
            حذف
          </button>
        </div>
      </header>

      <ClothingViewer product={product} size={size} />

      {product.sizes.length > 0 && (
        <div className="wd-field">
          <span className="wd-field__label">المقاس المعروض</span>
          <div className="wd-chip-row" role="group" aria-label="المقاس المعروض">
            {product.sizes.map((s) => (
              <button key={s} type="button" className="wd-chip" aria-pressed={s === size} onClick={() => onSizeChange(s)}>
                {s}
              </button>
            ))}
          </div>
          {!product.model && (
            <p className="wd-hint">تتغير أبعاد المعاينة التقريبية حسب قياسات المقاس المختار.</p>
          )}
        </div>
      )}

      <div className="wd-export">
        <button type="button" className="wd-btn wd-btn--primary wd-btn--block" onClick={onExport} disabled={exporting}>
          {exporting ? 'جارٍ التصدير…' : 'تصدير إلى غرفة القياس'}
        </button>
        <button type="button" className="wd-btn wd-btn--small wd-btn--text" onClick={onDownload}>
          تنزيل بيانات التصدير (JSON)
        </button>
      </div>

      <section>
        <h3>الصور</h3>
        <div className="wd-photo-pair">
          <figure>
            {product.images.front ? <img src={product.images.front} alt="الصورة الأمامية" /> : <span>لا توجد صورة</span>}
            <figcaption>الأمام</figcaption>
          </figure>
          <figure>
            {product.images.back ? <img src={product.images.back} alt="الصورة الخلفية" /> : <span>لا توجد صورة</span>}
            <figcaption>الخلف</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <h3>معلومات القطعة</h3>
        <dl className="wd-info">
          <dt>القماش</dt>
          <dd>
            {fabricDisplayName(product.fabric, product.fabricNote)} · {STRETCH_LABELS[product.stretch].label}
          </dd>
          <dt>نوع القصّة</dt>
          <dd>{FIT_LABELS[product.fit].label}</dd>
          <dt>اللون</dt>
          <dd>
            <span className="wd-dot" style={{ background: product.color }} aria-hidden="true" />{' '}
            <code dir="ltr">{product.color}</code>
          </dd>
          {product.extra.price !== null && (
            <>
              <dt>السعر</dt>
              <dd>{product.extra.price} ₪</dd>
            </>
          )}
          {product.extra.sku && (
            <>
              <dt>رمز المنتج</dt>
              <dd dir="ltr">{product.extra.sku}</dd>
            </>
          )}
          <dt>النموذج ثلاثي الأبعاد</dt>
          <dd>
            {!product.model
              ? 'غير متوفر (تُعرض معاينة تقريبية)'
              : product.model.kind === 'project'
                ? product.model.label
                : <bdi>{product.model.fileName}</bdi>}
          </dd>
        </dl>
        {product.description && <p className="wd-description">{product.description}</p>}
        {product.extra.notes && <p className="wd-hint">ملاحظات: {product.extra.notes}</p>}
      </section>

      <section>
        <h3>قياسات القطعة (سم)</h3>
        <div className="wd-table-scroll">
          <table className="wd-table">
            <thead>
              <tr>
                <th scope="col">القياس</th>
                {product.sizes.map((s) => (
                  <th key={s} scope="col" className={s === size ? 'wd-col--active' : undefined}>
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.key}>
                  <th scope="row">{MEASUREMENT_LABELS[f.key].label}</th>
                  {product.sizes.map((s) => (
                    <td key={s} className={s === size ? 'wd-col--active' : undefined}>
                      {product.measurements[s]?.[f.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
