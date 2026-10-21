import { LoaderCircle, WifiOff } from 'lucide-react';

export default function ConnectionBanner({ visible, className = '' }) {
  if (!visible) return null;
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 border-b border-amber-200/60 bg-amber-50/90 px-4 py-2.5 text-center text-xs font-semibold text-amber-800 backdrop-blur dark:border-amber-400/15 dark:bg-amber-400/10 dark:text-amber-200 ${className}`}
    >
      <WifiOff size={14} />
      Connection lost. Reconnecting…
      <LoaderCircle size={13} className="animate-spin" />
    </div>
  );
}
