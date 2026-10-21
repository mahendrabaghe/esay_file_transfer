import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Info, X } from 'lucide-react';

const TONES = {
  success: {
    icon: Check,
    iconClass: 'bg-emerald-500 text-white',
    border: 'border-emerald-200/70 dark:border-emerald-500/20',
  },
  error: {
    icon: AlertCircle,
    iconClass: 'bg-rose-500 text-white',
    border: 'border-rose-200/70 dark:border-rose-500/20',
  },
  info: {
    icon: Info,
    iconClass: 'bg-brand-500 text-white',
    border: 'border-brand-200/70 dark:border-brand-500/20',
  },
};

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, tone = 'success') => {
    setToast({ message, tone, id: `${Date.now()}-${Math.random()}` });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  return { toast, show, dismiss };
}

export function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDismiss, 3600);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const tone = TONES[toast.tone] || TONES.info;
  const Icon = tone.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[80] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-scale-in items-center gap-3 rounded-2xl border bg-surface/95 py-2.5 pl-2.5 pr-3 shadow-float backdrop-blur-xl ${tone.border}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.iconClass}`}>
        <Icon size={15} strokeWidth={2.6} />
      </span>
      <span className="min-w-0 text-[13px] font-semibold leading-snug text-ink">
        {toast.message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-subtle hover:text-ink"
        aria-label="Dismiss notification"
      >
        <X size={13} />
      </button>
    </div>
  );
}
