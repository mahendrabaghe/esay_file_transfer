import { Link } from 'react-router-dom';

export function BrandMark({ className = 'h-9 w-9' }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-[12px] bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 shadow-[0_7px_18px_-8px_rgba(88,54,204,0.8)] ${className}`}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.38),transparent_46%)]" />
      <svg viewBox="0 0 24 24" className="relative h-[58%] w-[58%] text-white" fill="currentColor">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" opacity="0.82" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" opacity="0.82" />
        <rect x="13.5" y="13.5" width="3" height="3" rx="0.9" />
        <rect x="18" y="18" width="2.5" height="2.5" rx="0.8" />
        <rect x="13.5" y="18" width="2.5" height="2.5" rx="0.8" opacity="0.62" />
        <rect x="18" y="13.5" width="2.5" height="2.5" rx="0.8" opacity="0.62" />
      </svg>
    </span>
  );
}

export default function Logo({ to = '/', className = '', showTagline = false }) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 ${className}`}
      aria-label="QuickDrop home"
    >
      <BrandMark />
      <span className="flex flex-col">
        <span className="text-[17px] font-[750] leading-none tracking-[-0.035em] text-ink">
          QuickDrop
        </span>
        {showTagline && (
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.17em] text-ink-muted">
            Scan. Share. Done.
          </span>
        )}
      </span>
    </Link>
  );
}
