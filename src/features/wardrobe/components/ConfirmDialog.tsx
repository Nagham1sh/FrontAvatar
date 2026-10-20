import { useEffect, useRef } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, message, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="wd-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="wd-dialog__body">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <footer className="wd-dialog__footer">
          <button type="button" className="wd-btn wd-btn--ghost" onClick={onCancel} disabled={busy} autoFocus>
            إلغاء
          </button>
          <button type="button" className="wd-btn wd-btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'جارٍ الحذف…' : confirmLabel}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
