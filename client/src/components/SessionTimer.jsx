import { Clock3 } from 'lucide-react';
import { formatCountdown } from '../lib/format.js';
import { useCountdown } from '../lib/useCountdown.js';

export default function SessionTimer({ expiresAt, className = '', compact = false }) {
  const remaining = useCountdown(expiresAt);
  const urgent = remaining > 0 && remaining <= 60 * 1000;
  const expired = remaining <= 0;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
        expired || urgent ? 'text-amber-600 dark:text-amber-300' : 'text-ink-muted'
      } ${className}`}
      title="Inactive sessions expire automatically"
    >
      <Clock3 size={13} strokeWidth={2} />
      {!compact && <span>{expired ? 'Expired' : 'Expires in'}</span>}
      {!expired && <span className="tabular-nums">{formatCountdown(remaining)}</span>}
    </span>
  );
}
