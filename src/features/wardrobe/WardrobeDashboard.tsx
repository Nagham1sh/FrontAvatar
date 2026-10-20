import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ProductCard } from './components/ProductCard';
import { ProductDetails } from './components/ProductDetails';
import { ProductFormDialog } from './components/ProductFormDialog';
import { Toast } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { ExportError, buildFittingRoomPayload, downloadPayload, exportProductToFittingRoom } from './fittingRoomExport';
import { GARMENT_TYPE_LABELS } from './garmentCatalog';
import { GARMENT_TYPES } from './types';
import type { ClothingProduct, GarmentType, ProductDraft, SizeLabel } from './types';
import { storageErrorMessage, useProducts } from './useProducts';
import './wardrobe.css';

type TypeFilter = GarmentType | 'all';

export function WardrobeDashboard() {
  const { products, status, error, reload, create, update, remove } = useProducts();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<SizeLabel | null>(null);
  const [formTarget, setFormTarget] = useState<ClothingProduct | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClothingProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const panel = useRef<HTMLElement>(null);

  function selectProduct(id: string) {
    setSelectedId(id);
    // On stacked (narrow) layouts the viewer sits below the list: bring it into view.
    if (window.matchMedia('(max-width: 1080px)').matches) {
      requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  const notify = useCallback((tone: ToastMessage['tone'], text: string, action?: ToastMessage['action']) => {
    setToast({ id: Date.now(), tone, text, action });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const selected = products.find((p) => p.id === selectedId) ?? null;

  // Keep a valid size selected for the chosen product.
  useEffect(() => {
    if (!selected) return;
    if (!selectedSize || !selected.sizes.includes(selectedSize)) {
      setSelectedSize(selected.sizes.includes('M') ? 'M' : (selected.sizes[0] ?? null));
    }
  }, [selected, selectedSize]);

  const counts = useMemo(() => {
    const result: Record<TypeFilter, number> = { all: products.length, tshirt: 0, shirt: 0, jacket: 0, dress: 0, pants: 0, skirt: 0 };
    for (const p of products) result[p.type] += 1;
    return result;
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ar');
    return products.filter(
      (p) => (typeFilter === 'all' || p.type === typeFilter) && (!q || p.name.toLocaleLowerCase('ar').includes(q)),
    );
  }, [products, query, typeFilter]);

  async function handleSubmit(draft: ProductDraft, existing: ClothingProduct | null) {
    const saved = existing ? await update(existing.id, draft) : await create(draft);
    setFormTarget(null);
    setSelectedId(saved.id);
    notify('success', existing ? `تم حفظ تعديلات «${saved.name}».` : `تمت إضافة «${saved.name}».`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      notify('success', `تم حذف «${deleteTarget.name}».`);
      setDeleteTarget(null);
    } catch (err) {
      notify('error', storageErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport(product: ClothingProduct | null) {
    setExporting(true);
    try {
      const payload = await exportProductToFittingRoom(product);
      notify(
        'success',
        `تم تصدير «${payload.garment.name}» إلى غرفة القياس (${payload.garment.sizes.length} مقاسات).`,
        <a className="wd-btn wd-btn--small wd-btn--ghost" href="#/fitting-room">
          فتح غرفة القياس
        </a>,
      );
    } catch (err) {
      console.error(err);
      notify(
        'error',
        err instanceof ExportError
          ? `لا يمكن التصدير: ${err.problems.join(' ')}`
          : `فشل التصدير: ${storageErrorMessage(err)}`,
      );
    } finally {
      setExporting(false);
    }
  }

  function handleDownload(product: ClothingProduct) {
    const check = buildFittingRoomPayload(product);
    if (check.ok) downloadPayload(check.payload);
    else notify('error', `لا يمكن تجهيز البيانات: ${check.problems.join(' ')}`);
  }

  return (
    <div className="wd" dir="rtl" lang="ar">
      <header className="wd-header">
        <div>
          <h1>لوحة إدارة الملابس</h1>
          <p className="wd-muted">أضف قطع محلك، أدخل قياساتها، واعرضها ثلاثيًا قبل إرسالها إلى غرفة القياس.</p>
        </div>
        <button type="button" className="wd-btn wd-btn--primary" onClick={() => setFormTarget('new')}>
          + إضافة قطعة
        </button>
      </header>

      <div className="wd-toolbar">
        <label className="wd-search">
          <span className="wd-visually-hidden">البحث باسم القطعة</span>
          <input
            type="search"
            className="wd-input"
            placeholder="ابحث باسم القطعة…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="wd-chip-row" role="group" aria-label="تصنيف حسب النوع">
          <button type="button" className="wd-chip" aria-pressed={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
            الكل <span className="wd-chip__count">{counts.all}</span>
          </button>
          {GARMENT_TYPES.map((t) => (
            <button key={t} type="button" className="wd-chip" aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {GARMENT_TYPE_LABELS[t]} <span className="wd-chip__count">{counts[t]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="wd-layout">
        <section className="wd-catalog" aria-label="قطع الملابس">
          {status === 'loading' && (
            <div className="wd-state" role="status">
              <span className="wd-spinner" aria-hidden="true" /> جارٍ تحميل القطع…
            </div>
          )}

          {status === 'error' && (
            <div className="wd-state wd-state--error" role="alert">
              <p>{error}</p>
              <button type="button" className="wd-btn wd-btn--ghost" onClick={() => void reload()}>
                إعادة المحاولة
              </button>
            </div>
          )}

          {status === 'ready' && products.length === 0 && (
            <div className="wd-state wd-state--empty">
              <div className="wd-state__icon" aria-hidden="true">👕</div>
              <h2>لا توجد قطع ملابس بعد</h2>
              <p>ابدأ بإضافة أول قطعة: الاسم، النوع، الصور، القماش، والمقاسات مع قياساتها.</p>
              <button type="button" className="wd-btn wd-btn--primary" onClick={() => setFormTarget('new')}>
                إضافة أول قطعة
              </button>
            </div>
          )}

          {status === 'ready' && products.length > 0 && visible.length === 0 && (
            <div className="wd-state">
              <p>لا توجد نتائج مطابقة{query.trim() ? ` لـ «${query.trim()}»` : ''}.</p>
              <button
                type="button"
                className="wd-btn wd-btn--ghost"
                onClick={() => {
                  setQuery('');
                  setTypeFilter('all');
                }}
              >
                مسح البحث والتصنيف
              </button>
            </div>
          )}

          {visible.length > 0 && (
            <div className="wd-grid">
              {visible.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  selected={product.id === selectedId}
                  onSelect={() => selectProduct(product.id)}
                  onEdit={() => setFormTarget(product)}
                  onDelete={() => setDeleteTarget(product)}
                />
              ))}
            </div>
          )}
        </section>

        <aside ref={panel} className="wd-panel" aria-label="تفاصيل القطعة">
          {selected ? (
            <ProductDetails
              key={selected.id}
              product={selected}
              size={selectedSize}
              exporting={exporting}
              onSizeChange={setSelectedSize}
              onEdit={() => setFormTarget(selected)}
              onDelete={() => setDeleteTarget(selected)}
              onExport={() => void handleExport(selected)}
              onDownload={() => handleDownload(selected)}
            />
          ) : (
            <div className="wd-state wd-state--panel">
              <h2>العرض ثلاثي الأبعاد</h2>
              <p>اختر قطعة من القائمة لعرضها ثلاثيًا ومعاينة تفاصيلها وتصديرها إلى غرفة القياس.</p>
              <button
                type="button"
                className="wd-btn wd-btn--primary"
                disabled={products.length === 0}
                onClick={() => void handleExport(null)}
              >
                تصدير إلى غرفة القياس
              </button>
            </div>
          )}
        </aside>
      </div>

      <ProductFormDialog target={formTarget} onClose={() => setFormTarget(null)} onSubmit={handleSubmit} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="حذف القطعة"
        message={deleteTarget ? `هل أنت متأكد من حذف «${deleteTarget.name}»؟ لا يمكن التراجع عن هذه العملية.` : ''}
        confirmLabel="حذف نهائي"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
