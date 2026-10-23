import type {
  FabricId,
  FitType,
  GarmentMeasurements,
  GarmentType,
  SizeLabel,
  StretchLevel,
} from '../../features/wardrobe/types';
import type { GarmentCategory } from '../../features/wardrobe/garmentCatalog';

export const GARMENT_PAYLOAD_SCHEMA = 'palestine-tryon/garment@1';

export type FittingRoomModel =
  /** A file served by this app, e.g. "/models/shirt_M.glb". */
  | { kind: 'url'; url: string }
  /** A GLB uploaded by the shop owner, embedded as a data URL (loadable by useGLTF). */
  | { kind: 'embedded-glb'; dataUrl: string; fileName: string };

/**
 * Everything the fitting room needs to know about one garment, as plain JSON
 * (safe to store, send to an API, or download). Measurements are GARMENT
 * measurements in cm (circumferences except shoulder/lengths), not body sizes.
 */
export type FittingRoomGarmentPayload = {
  schema: typeof GARMENT_PAYLOAD_SCHEMA;
  exportId: string;
  exportedAt: string;
  source: 'wardrobe-dashboard';
  garment: {
    productId: string;
    name: string;
    type: GarmentType;
    typeLabel: string;
    category: GarmentCategory;
    description: string;
    color: string;
    fabric: { id: FabricId; label: string; stretch: StretchLevel };
    /** Intended cut; the ease expected over the body depends on it. */
    fit: FitType;
    images: { front: string; back: string | null };
    sizes: { size: SizeLabel; measurementsCm: GarmentMeasurements }[];
    model: FittingRoomModel | null;
    extra: { price: number | null; sku: string; notes: string };
    productUpdatedAt: string;
  };
};
