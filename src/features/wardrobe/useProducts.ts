import { useCallback, useEffect, useState } from 'react';
import { isQuotaError } from '../../lib/idb';
import * as repository from './productRepository';
import type { ClothingProduct, ProductDraft } from './types';

export type ProductsStatus = 'loading' | 'ready' | 'error';

export function storageErrorMessage(error: unknown): string {
  if (isQuotaError(error)) {
    return 'مساحة التخزين في المتصفح ممتلئة. احذف بعض القطع أو استخدم صورًا ونماذج أصغر.';
  }
  if (error instanceof Error && /[؀-ۿ]/.test(error.message)) return error.message;
  return 'تعذّر الوصول إلى التخزين المحلي في المتصفح (قد يكون التصفح الخاص مفعّلًا).';
}

export function useProducts() {
  const [products, setProducts] = useState<ClothingProduct[]>([]);
  const [status, setStatus] = useState<ProductsStatus>('loading');
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      setProducts(await repository.listProducts());
      setStatus('ready');
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(storageErrorMessage(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(async (draft: ProductDraft) => {
    const product = await repository.createProduct(draft);
    setProducts((current) => [product, ...current]);
    return product;
  }, []);

  const update = useCallback(async (id: string, draft: ProductDraft) => {
    const product = await repository.updateProduct(id, draft);
    setProducts((current) => [product, ...current.filter((p) => p.id !== id)]);
    return product;
  }, []);

  const remove = useCallback(async (id: string) => {
    await repository.deleteProduct(id);
    setProducts((current) => current.filter((p) => p.id !== id));
  }, []);

  return { products, status, error, reload, create, update, remove };
}
