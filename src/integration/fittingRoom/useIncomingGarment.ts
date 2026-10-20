import { useCallback, useEffect, useState } from 'react';
import { clearPendingGarment, getPendingGarment, subscribeToFittingRoomHandoff } from './handoff';
import type { FittingRoomGarmentPayload } from './types';

/**
 * Fitting-room side of the hand-off: the garment most recently exported from
 * the wardrobe dashboard (updates live, also across tabs).
 */
export function useIncomingGarment() {
  const [garment, setGarment] = useState<FittingRoomGarmentPayload | null>(null);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      setGarment(await getPendingGarment());
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError('تعذّر قراءة القطعة المصدّرة من التخزين المحلي.');
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeToFittingRoomHandoff(() => void refresh());
  }, [refresh]);

  const clear = useCallback(async () => {
    await clearPendingGarment();
    setGarment(null);
  }, []);

  return { garment, error, clear };
}
