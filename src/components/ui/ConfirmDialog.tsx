'use client';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isOpen,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {message}
          </p>
        </div>
        <div
          className="flex justify-end gap-2 border-t px-5 py-3"
          style={{ borderColor: 'var(--border-main)' }}
        >
          <button
            onClick={onClose}
            className="form-btn-cancel cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: 'var(--color-danger)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
