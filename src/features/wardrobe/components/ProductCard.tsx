import { fabricDisplayName } from '../fabrics';
import { GARMENT_TYPE_LABELS } from '../garmentCatalog';
import type { ClothingProduct } from '../types';

type ProductCardProps = {
  product: ClothingProduct;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function ProductCard({ product, selected, onSelect, onEdit, onDelete }: ProductCardProps) {
  return (
    <article className={`wd-card${selected ? ' wd-card--selected' : ''}`}>
      <button
        type="button"
        className="wd-card__select"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`عرض ${product.name}`}
      >
        <div className="wd-card__media">
          {product.images.front ? (
            <img src={product.images.front} alt="" loading="lazy" className="wd-card__img" />
          ) : (
            <span className="wd-card__placeholder">لا توجد صورة</span>
          )}
          {product.images.back && (
            <img src={product.images.back} alt="" loading="lazy" className="wd-card__img wd-card__img--back" />
          )}
          <span className="wd-badge wd-badge--type">{GARMENT_TYPE_LABELS[product.type]}</span>
          {product.model && <span className="wd-badge wd-badge--3d">3D</span>}
        </div>
        <div className="wd-card__body">
          <h3 className="wd-card__title">{product.name}</h3>
          <p className="wd-card__meta">
            <span className="wd-dot" style={{ background: product.color }} aria-hidden="true" />
            {fabricDisplayName(product.fabric, product.fabricNote)}
            {product.extra.price !== null && <span className="wd-card__price">{product.extra.price} ₪</span>}
          </p>
          <ul className="wd-size-list" aria-label="المقاسات المتوفرة">
            {product.sizes.map((size) => (
              <li key={size}>{size}</li>
            ))}
          </ul>
        </div>
      </button>
      <div className="wd-card__actions">
        <button type="button" className="wd-btn wd-btn--small wd-btn--ghost" onClick={onEdit}>
          تعديل
        </button>
        <button type="button" className="wd-btn wd-btn--small wd-btn--danger-ghost" onClick={onDelete}>
          حذف
        </button>
      </div>
    </article>
  );
}
