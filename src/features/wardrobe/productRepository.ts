import { KeyValueStore, createId } from '../../lib/idb';
import { normalizeDraft } from './validation';
import { withDefaults } from './types';
import type { ClothingProduct, ProductDraft } from './types';

/**
 * Temporary persistence: the project has no clothing backend yet, so products
 * live in the browser's IndexedDB (per browser / per device). Swap this module
 * for API calls once a backend exists — the rest of the UI only uses these
 * four functions.
 */
const store = new KeyValueStore<ClothingProduct>('palestine-tryon-wardrobe', 'products');

export async function listProducts(): Promise<ClothingProduct[]> {
  const products = (await store.getAll()).map(withDefaults);
  return products.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createProduct(draft: ProductDraft): Promise<ClothingProduct> {
  const now = new Date().toISOString();
  const product: ClothingProduct = {
    ...normalizeDraft(draft),
    id: createId(),
    createdAt: now,
    updatedAt: now,
  };
  await store.put(product.id, product);
  return product;
}

export async function updateProduct(id: string, draft: ProductDraft): Promise<ClothingProduct> {
  const existing = await store.get(id);
  if (!existing) throw new Error('هذه القطعة لم تعد موجودة.');

  const product: ClothingProduct = {
    ...normalizeDraft(draft),
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await store.put(id, product);
  return product;
}

export async function deleteProduct(id: string): Promise<void> {
  await store.delete(id);
}
