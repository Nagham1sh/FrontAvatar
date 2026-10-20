import { KeyValueStore } from '../../lib/idb';
import type { GarmentMeasurements, MeasurementKey, SizeLabel } from '../../features/wardrobe/types';
import { GARMENT_PAYLOAD_SCHEMA } from './types';
import type { FittingRoomGarmentPayload } from './types';

/**
 * Hand-off channel between the wardrobe dashboard (producer) and the fitting
 * room (consumer). Both pages run in the same front-end app, so the payload is
 * kept in IndexedDB (survives reloads, no size limit issues with images) and
 * listeners are notified in this tab (window event) and in other open tabs
 * (BroadcastChannel). When a backend exists, replace put/get with API calls and
 * keep the same function signatures.
 */
const store = new KeyValueStore<FittingRoomGarmentPayload>('palestine-tryon-fitting-room', 'handoff');
const PENDING_KEY = 'pending-garment';
const EVENT_NAME = 'fitting-room:garment-changed';
const CHANNEL_NAME = 'fitting-room-handoff';

function notify(): void {
  window.dispatchEvent(new Event(EVENT_NAME));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: 'changed' });
    channel.close();
  }
}

export function isGarmentPayload(value: unknown): value is FittingRoomGarmentPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Partial<FittingRoomGarmentPayload>;
  return payload.schema === GARMENT_PAYLOAD_SCHEMA && typeof payload.garment?.productId === 'string';
}

/** Stores the garment for the fitting room and verifies it can be read back. */
export async function sendGarmentToFittingRoom(
  payload: FittingRoomGarmentPayload,
): Promise<FittingRoomGarmentPayload> {
  await store.put(PENDING_KEY, payload);
  const stored = await store.get(PENDING_KEY);
  if (!isGarmentPayload(stored) || stored.exportId !== payload.exportId) {
    throw new Error('تعذّر التحقق من وصول القطعة إلى غرفة القياس.');
  }
  notify();
  return stored;
}

export async function getPendingGarment(): Promise<FittingRoomGarmentPayload | null> {
  const stored = await store.get(PENDING_KEY);
  return isGarmentPayload(stored) ? stored : null;
}

export async function clearPendingGarment(): Promise<void> {
  await store.delete(PENDING_KEY);
  notify();
}

export function subscribeToFittingRoomHandoff(listener: () => void): () => void {
  window.addEventListener(EVENT_NAME, listener);
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;
  channel?.addEventListener('message', listener);

  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    channel?.close();
  };
}

/** Model URL usable directly with useGLTF, or null when the garment has no 3D model. */
export function garmentModelUrl(payload: FittingRoomGarmentPayload): string | null {
  const model = payload.garment.model;
  if (!model) return null;
  return model.kind === 'url' ? model.url : model.dataUrl;
}

/**
 * Convenience for the size / fit code: one measurement across all sizes,
 * e.g. getMeasurementBySize(payload, 'chest') -> { S: 96, M: 104 }.
 */
export function getMeasurementBySize(
  payload: FittingRoomGarmentPayload,
  key: MeasurementKey,
): Partial<Record<SizeLabel, number>> {
  const result: Partial<Record<SizeLabel, number>> = {};
  for (const entry of payload.garment.sizes) {
    const value = (entry.measurementsCm as GarmentMeasurements)[key];
    if (typeof value === 'number') result[entry.size] = value;
  }
  return result;
}
