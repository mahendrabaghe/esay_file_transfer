import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, X } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
  icon: Icon,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const timer = setTimeout(() => confirmRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-[#0b0b14]/45 backdrop-blur-[3px]"
        aria-label="Close dialog"
        onClick={() => !busy && onCancel?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="relative w-full max-w-[430px] animate-scale-in rounded-[28px] border border-line bg-surface p-6 shadow-float sm:p-7"
      >
        <button
          type="button"
          onClick={() => !busy && onCancel?.()}
          className="icon-btn absolute right-3 top-3 h-9 w-9"
          aria-label="Close"
          disabled={busy}
        >
          <X size={17} />
        </button>
        {Icon && (
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <Icon size={22} strokeWidth={1.9} />
          </span>
        )}
        <h2 id="confirm-title" className="pr-8 text-[21px] font-[750] tracking-[-0.035em] text-ink">
          {title}
        </h2>
        <p id="confirm-description" className="mt-2 text-sm leading-6 text-ink-soft">
          {description}
        </p>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn px-5 py-3 text-white ${
              danger
                ? 'bg-rose-600 hover:bg-rose-500 focus-visible:ring-rose-500/20'
                : 'bg-brand-600 hover:bg-brand-500 focus-visible:ring-brand-500/20'
            }`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <LoaderCircle size={15} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
