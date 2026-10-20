import { createId } from '../../lib/idb';
import { sendGarmentToFittingRoom } from '../../integration/fittingRoom/handoff';
import { GARMENT_PAYLOAD_SCHEMA } from '../../integration/fittingRoom/types';
import type { FittingRoomGarmentPayload, FittingRoomModel } from '../../integration/fittingRoom/types';
import { fabricDisplayName } from './fabrics';
import { GARMENT_CATEGORY, GARMENT_TYPE_LABELS } from './garmentCatalog';
import { describeErrors, normalizeDraft, validateProductDraft } from './validation';
import type { ClothingProduct, ModelRef } from './types';

export type ExportCheck =
  | { ok: true; payload: FittingRoomGarmentPayload }
  | { ok: false; problems: string[] };

function toFittingRoomModel(model: ModelRef | null): FittingRoomModel | null {
  if (!model) return null;
  if (model.kind === 'project') return { kind: 'url', url: model.url };
  return { kind: 'embedded-glb', dataUrl: model.dataUrl, fileName: model.fileName };
}

/** Pure: validates the product and builds the JSON payload for the fitting room. */
export function buildFittingRoomPayload(
  product: ClothingProduct | null | undefined,
  options: { exportId?: string; now?: Date } = {},
): ExportCheck {
  if (!product) return { ok: false, problems: ['اختر قطعة ملابس أولًا.'] };

  const errors = validateProductDraft(product);
  if (Object.keys(errors).length > 0) {
    return { ok: false, problems: describeErrors(errors) };
  }

  const clean = normalizeDraft(product);
  const front = clean.images.front;
  if (!front) return { ok: false, problems: ['صورة القطعة من الأمام مطلوبة.'] };

  return {
    ok: true,
    payload: {
      schema: GARMENT_PAYLOAD_SCHEMA,
      exportId: options.exportId ?? createId(),
      exportedAt: (options.now ?? new Date()).toISOString(),
      source: 'wardrobe-dashboard',
      garment: {
        productId: product.id,
        name: clean.name,
        type: clean.type,
        typeLabel: GARMENT_TYPE_LABELS[clean.type],
        category: GARMENT_CATEGORY[clean.type],
        description: clean.description,
        color: clean.color,
        fabric: { id: clean.fabric, label: fabricDisplayName(clean.fabric, clean.fabricNote) },
        images: { front, back: clean.images.back },
        sizes: clean.sizes.map((size) => ({ size, measurementsCm: { ...clean.measurements[size] } })),
        model: toFittingRoomModel(clean.model),
        extra: { ...clean.extra },
        productUpdatedAt: product.updatedAt,
      },
    },
  };
}

export class ExportError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(problems.join(' '));
    this.problems = problems;
  }
}

export async function exportProductToFittingRoom(
  product: ClothingProduct | null | undefined,
): Promise<FittingRoomGarmentPayload> {
  const check = buildFittingRoomPayload(product);
  if (!check.ok) throw new ExportError(check.problems);
  return sendGarmentToFittingRoom(check.payload);
}

/** Lets the team inspect / hand over the exact payload as a JSON file. */
export function downloadPayload(payload: FittingRoomGarmentPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `garment-${payload.garment.productId.slice(0, 8)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
