/**
 * Product data owned by the wardrobe (clothing management) dashboard.
 *
 * All measurements here describe the GARMENT itself (in cm), never the
 * user's body. Body measurements live in the avatar / fitting-room code.
 */

export const GARMENT_TYPES = ['tshirt', 'shirt', 'jacket', 'dress', 'pants', 'skirt'] as const;
export type GarmentType = (typeof GARMENT_TYPES)[number];

export const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type SizeLabel = (typeof SIZE_LABELS)[number];

export const MEASUREMENT_KEYS = [
  'chest',
  'waist',
  'hips',
  'shoulder',
  'length',
  'sleeveLength',
  'neck',
  'inseam',
  'thigh',
  'legOpening',
] as const;
export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];

/** Garment measurements for one size, in centimetres. */
export type GarmentMeasurements = Partial<Record<MeasurementKey, number>>;

export const FABRIC_IDS = [
  'cotton',
  'linen',
  'wool',
  'silk',
  'satin',
  'denim',
  'polyester',
  'chiffon',
  'velvet',
  'leather',
  'knit',
  'other',
] as const;
export type FabricId = (typeof FABRIC_IDS)[number];

/** Where the product's 3D model comes from, if it has one. */
export type ModelRef =
  | { kind: 'project'; url: string; label: string }
  | { kind: 'upload'; dataUrl: string; fileName: string; sizeBytes: number };

export type ProductExtra = {
  price: number | null;
  sku: string;
  notes: string;
};

export type ClothingProduct = {
  id: string;
  name: string;
  type: GarmentType;
  fabric: FabricId;
  /** Free-text fabric name, used when fabric is 'other'. */
  fabricNote: string;
  /** Main colour (hex), used to tint the 3D preview. */
  color: string;
  description: string;
  /** Images are stored as compressed data URLs. */
  images: { front: string | null; back: string | null };
  sizes: SizeLabel[];
  measurements: Partial<Record<SizeLabel, GarmentMeasurements>>;
  model: ModelRef | null;
  extra: ProductExtra;
  createdAt: string;
  updatedAt: string;
};

export type ProductDraft = Omit<ClothingProduct, 'id' | 'createdAt' | 'updatedAt'>;

export function emptyDraft(): ProductDraft {
  return {
    name: '',
    type: 'tshirt',
    fabric: 'cotton',
    fabricNote: '',
    color: '#c9c3b8',
    description: '',
    images: { front: null, back: null },
    sizes: [],
    measurements: {},
    model: null,
    extra: { price: null, sku: '', notes: '' },
  };
}

export function draftFromProduct(product: ClothingProduct): ProductDraft {
  const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = product;
  return structuredClone(draft);
}
