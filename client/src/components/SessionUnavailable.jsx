import { Link } from 'react-router-dom';
import {
  Clock3,
  Link2Off,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  CircleSlash2,
  WifiOff,
} from 'lucide-react';
import TopBar from './TopBar.jsx';

const VARIANTS = {
  expired: {
    icon: Clock3,
    eyebrow: 'Session expired',
    title: 'This drop has closed.',
    description:
      'Drops go quiet after a while. The files and notes in this session have been removed automatically — nothing was kept.',
    accent: 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300',
  },
  stopped: {
    icon: CircleSlash2,
    eyebrow: 'Sharing stopped',
    title: 'The drop was ended.',
    description:
      'Sharing was stopped from the receiving device. Everything in this drop is gone, and the QR code no longer works.',
    accent: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300',
  },
  'not-found': {
    icon: Link2Off,
    eyebrow: 'Link not found',
    title: "This drop isn't here.",
    description:
      'The link may be mistyped, or this session has already closed. Start a fresh drop from the laptop to get a new QR code.',
    accent: 'bg-brand-50 text-brand-600 dark:bg-brand-400/10 dark:text-brand-300',
  },
  'invalid-link': {
    icon: ShieldAlert,
    eyebrow: 'Wrong kind of link',
    title: "This link can't be used here.",
    description:
      'Use the QR code shown on the receiving laptop to open the sender screen. If you are at the laptop, start a new drop to share again.',
    accent: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  },
  error: {
    icon: WifiOff,
    eyebrow: 'Connection lost',
    title: 'QuickDrop is out of reach.',
    description:
      'We could not open this drop right now. Check your connection and try again. Your session may still be waiting.',
    accent: 'bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300',
  },
};

export default function SessionUnavailable({ kind = 'expired', error, onRetry }) {
  const variant = VARIANTS[kind] || VARIANTS.expired;
  const Icon = variant.icon;
  const showRetry = kind === 'error' && onRetry;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        right={
          <span className="hidden items-center gap-1.5 text-[11px] font-semibold text-ink-muted sm:inline-flex">
            <ShieldCheck size={13} className="text-emerald-500" />
            Private by design
          </span>
        }
      />
      <main className="container-page relative flex flex-1 items-center justify-center py-14 sm:py-20">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line/50 opacity-60 [mask-image:radial-gradient(closest-side,black,transparent)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line/70 opacity-70"
          aria-hidden="true"
        />
        <div className="relative max-w-[520px] animate-fade-up text-center">
          <span
            className={`mx-auto flex h-[70px] w-[70px] items-center justify-center rounded-[24px] ${variant.accent} shadow-sm`}
          >
            <Icon size={29} strokeWidth={1.8} />
          </span>
          <p className="eyebrow mt-7">{variant.eyebrow}</p>
          <h1 className="mt-3 text-[clamp(2.15rem,5vw,3.3rem)] font-[750] leading-[1.03] tracking-[-0.055em] text-ink">
            {variant.title}
          </h1>
          <p className="mx-auto mt-4 max-w-[440px] text-[15px] leading-7 text-ink-soft">
            {kind === 'error' && error ? error : variant.description}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
            {showRetry && (
              <button type="button" className="btn btn-secondary btn-lg" onClick={onRetry}>
                <RefreshCw size={16} />
                Try again
              </button>
            )}
            <Link to="/" className="btn btn-primary btn-lg">
              <Sparkles size={16} />
              Start a new drop
            </Link>
          </div>
          <p className="mt-8 inline-flex items-center gap-2 text-xs font-medium text-ink-muted">
            <ShieldCheck size={14} className="text-emerald-500" />
            Temporary sessions. Automatic cleanup. No account.
          </p>
        </div>
      </main>
      <footer className="container-page pb-8 text-center text-[11px] text-ink-muted">
        QuickDrop · Scan. Share. Done.
      </footer>
    </div>
  );
}
