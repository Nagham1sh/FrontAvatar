import { useEffect } from 'react';
import type { ReactNode } from 'react';

export type ToastMessage = {
  id: number;
  tone: 'success' | 'error';
  text: string;
  action?: ReactNode;
};

export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, toast.tone === 'error' ? 9000 : 6000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div className="wd-toast-region" aria-live="polite">
      {toast && (
        <div className={`wd-toast wd-toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <span>{toast.text}</span>
          {toast.action}
          <button type="button" className="wd-icon-btn" aria-label="إغلاق الإشعار" onClick={onDismiss}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
