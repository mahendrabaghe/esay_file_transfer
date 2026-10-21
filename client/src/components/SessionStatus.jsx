import { Radio } from 'lucide-react';

export default function SessionStatus({ presence, channel }) {
  const receiving = Boolean(presence?.receiving);
  const connected = Boolean(presence?.senders > 0);
  const reconnecting = channel === 'reconnecting';

  let label = 'Waiting for connection';
  let styles = 'border-line bg-subtle text-ink-soft';
  let dot = 'bg-ink-muted';

  if (receiving) {
    label = 'Receiving files';
    styles = 'border-brand-200/70 bg-brand-50 text-brand-700 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200';
    dot = 'bg-brand-500';
  } else if (connected) {
    label = 'Connected';
    styles = 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300';
    dot = 'bg-emerald-500';
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-[-0.01em] ${styles}`}
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        {receiving && (
          <span className={`absolute inset-0 animate-pulse-ring rounded-full ${dot}`} />
        )}
        <span className={`relative h-2 w-2 rounded-full ${dot}`} />
      </span>
      {label}
      {reconnecting && (
        <span className="ml-0.5 flex items-center gap-1 border-l border-ink-muted/20 pl-2 text-[10px] font-semibold opacity-75">
          <Radio size={10} />
          syncing
        </span>
      )}
    </span>
  );
}
