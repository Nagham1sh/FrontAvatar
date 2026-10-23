import { KeyValueStore, createId } from '../../lib/idb';
import { autoProductName, isAutoProductName } from './garmentCatalog';
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

/**
 * The form has no name field: a new product is named after its type
 * («فستان 3»). Editing keeps the name, unless it was generated and the type
 * changed, in which case it is renamed for the new type.
 */
async function resolveName(draft: ProductDraft, existing?: ClothingProduct): Promise<string> {
  const typed = draft.name.trim();
  if (existing && typed === existing.name && !(isAutoProductName(typed) && draft.type !== existing.type)) {
    return typed;
  }
  if (typed && !isAutoProductName(typed)) return typed;
  const others = (await store.getAll()).filter((p) => p.id !== existing?.id).map((p) => p.name);
  return autoProductName(draft.type, others);
}

export async function createProduct(draft: ProductDraft): Promise<ClothingProduct> {
  const now = new Date().toISOString();
  const product: ClothingProduct = {
    ...normalizeDraft(draft),
    name: await resolveName(draft),
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
    name: await resolveName(draft, existing),
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
