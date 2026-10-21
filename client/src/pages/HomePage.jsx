import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  Check,
  Clock3,
  FileArchive,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MonitorSmartphone,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Video,
} from 'lucide-react';
import TopBar from '../components/TopBar.jsx';
import HeroVisual from '../components/HeroVisual.jsx';
import Logo from '../components/Logo.jsx';
import { api } from '../lib/api.js';
import { readErrorMessage } from '../lib/format.js';

const STEPS = [
  {
    number: '01',
    icon: QrCode,
    title: 'Start a private drop',
    description:
      'One click creates a temporary session and a scannable QR code. No account, no setup, no downloads.',
    tint: 'bg-brand-50 text-brand-600 dark:bg-brand-400/10 dark:text-brand-300',
  },
  {
    number: '02',
    icon: ScanLine,
    title: 'Scan with your camera',
    description:
      'Point your phone camera at the code. QuickDrop opens instantly in the browser — photos, files, text or links.',
    tint: 'bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300',
  },
  {
    number: '03',
    icon: MonitorSmartphone,
    title: 'Share. Then it disappears.',
    description:
      'Files appear live on your laptop. Download one or all, then walk away. Temporary files are cleaned up automatically.',
    tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300',
  },
];

const FILE_TYPES = [
  { icon: ImageIcon, label: 'Photos' },
  { icon: Video, label: 'Videos' },
  { icon: FileArchive, label: 'Documents' },
  { icon: Link2, label: 'Links' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const startLock = useRef(false);

  async function startReceiving() {
    if (startLock.current) return;
    startLock.current = true;
    setStarting(true);
    setError(null);

    try {
      const data = await api.createSession();
      navigate(`/receive/${data.receiverToken}`);
    } catch (caught) {
      setError(readErrorMessage(caught, 'Could not start a drop. Please try again.'));
      setStarting(false);
      startLock.current = false;
    }
  }

  return (
    <div className="min-h-screen">
      <TopBar
        right={
          <a
            href="#how-it-works"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-ink-soft transition hover:bg-subtle hover:text-ink sm:inline-flex"
          >
            How it works
            <ArrowDown size={13} />
          </a>
        }
      />

      <main>
        <section className="container-page relative pb-20 pt-12 sm:pt-16 lg:pb-28 lg:pt-24">
          <div className="grid items-center gap-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 xl:gap-14">
            <div className="relative z-10 mx-auto max-w-[640px] animate-fade-up text-center lg:mx-0 lg:text-left">
              <div className="pill mx-auto w-fit border-brand-200/70 bg-brand-50/70 text-brand-700 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200 lg:mx-0">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand-400" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-brand-500" />
                </span>
                Scan. Share. Done.
                <span className="h-3 w-px bg-brand-300/70 dark:bg-brand-400/30" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">No app needed</span>
              </div>

              <h1 className="mt-6 text-[clamp(3.25rem,7vw,5.65rem)] font-[760] leading-[0.94] tracking-[-0.065em] text-ink sm:leading-[0.92]">
                Share anything.
                <br />
                <span className="text-gradient">Just scan.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-[510px] text-[15px] leading-7 text-ink-soft sm:text-[16px] lg:mx-0">
                Move photos, videos, documents and thoughts between your phone and laptop in
                seconds. No app to install. No account to make. Just a private, temporary drop.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <button
                  type="button"
                  onClick={startReceiving}
                  disabled={starting}
                  className="btn btn-primary btn-lg group w-full min-w-[214px] sm:w-auto"
                >
                  {starting ? (
                    <>
                      <LoaderCircle size={18} className="animate-spin" />
                      Preparing your drop
                    </>
                  ) : (
                    <>
                      <QrCode size={18} strokeWidth={2.2} />
                      Start receiving
                      <ArrowRight
                        size={17}
                        className="ml-0.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </>
                  )}
                </button>
                <a href="#how-it-works" className="btn btn-secondary btn-lg w-full sm:w-auto">
                  See how it works
                </a>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mx-auto mt-4 max-w-[440px] rounded-2xl border border-rose-200/70 bg-rose-50 px-4 py-3 text-left text-xs font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 lg:mx-0"
                >
                  {error}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 text-[11px] font-semibold text-ink-muted lg:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <LockKeyhole size={13} className="text-ink-soft" />
                  Private session tokens
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 size={13} className="text-ink-soft" />
                  Auto-deletes when done
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  No sign-up
                </span>
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  Send
                </span>
                {FILE_TYPES.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-surface/65 px-3 py-1.5 text-[11px] font-semibold text-ink-soft backdrop-blur-sm"
                  >
                    <Icon size={12} strokeWidth={1.9} />
                    {label}
                  </span>
                ))}
                <span className="rounded-full border border-line/80 bg-surface/65 px-3 py-1.5 text-[11px] font-semibold text-ink-soft backdrop-blur-sm">
                  & more
                </span>
              </div>
            </div>

            <HeroVisual />
          </div>
        </section>

        <section id="how-it-works" className="container-page scroll-mt-24 pb-20 sm:pb-24">
          <div className="overflow-hidden rounded-[34px] border border-line/80 bg-surface/70 shadow-card backdrop-blur-sm">
            <div className="flex flex-col gap-3 border-b border-line/70 px-6 py-7 sm:flex-row sm:items-end sm:justify-between sm:px-9 sm:py-8">
              <div>
                <p className="eyebrow">Three tiny steps</p>
                <h2 className="mt-2 text-[clamp(1.65rem,3vw,2.3rem)] font-[750] tracking-[-0.045em] text-ink">
                  Pocket to desktop, in a heartbeat.
                </h2>
              </div>
              <p className="max-w-[320px] text-[13px] leading-6 text-ink-soft">
                Built for the moments when AirDrop isn&apos;t there, messaging yourself feels
                silly, and email is just too much.
              </p>
            </div>

            <div className="grid divide-y divide-line/70 md:grid-cols-3 md:divide-x md:divide-y-0">
              {STEPS.map(({ number, icon: Icon, title, description, tint }) => (
                <div
                  key={number}
                  className="group relative p-6 transition-colors duration-300 hover:bg-subtle/45 sm:p-8"
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${tint}`}>
                      <Icon size={20} strokeWidth={1.9} />
                    </span>
                    <span className="text-[11px] font-extrabold tracking-[0.14em] text-ink-muted/60">
                      {number}
                    </span>
                  </div>
                  <h3 className="mt-6 text-[16px] font-bold tracking-[-0.025em] text-ink">{title}</h3>
                  <p className="mt-2.5 text-[13px] leading-6 text-ink-soft">{description}</p>
                </div>
              ))}
            </div>

            <div className="m-3 mt-0 overflow-hidden rounded-[26px] bg-[#15162a] text-white sm:m-4 sm:mt-0">
              <div className="relative card-grid-glow grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-brand-200">
                  <ShieldCheck size={23} strokeWidth={1.8} />
                </span>
                <div>
                  <h3 className="text-[18px] font-bold tracking-[-0.03em]">
                    One session. One audience. Zero leftovers.
                  </h3>
                  <p className="mt-1.5 max-w-[670px] text-[12.5px] leading-6 text-white/60">
                    Every drop uses cryptographically random access tokens, enforces active-session
                    checks, and cleans its temporary files without keeping an archive.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Token-protected', 'Auto-deleted', 'No tracking'].map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold text-white/70"
                    >
                      <Check size={11} className="text-emerald-300" strokeWidth={2.8} />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container-page pb-20">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: UploadCloud,
                title: 'Built for the big stuff',
                text: 'Chunked uploads with progress, live speed and automatic retries for large files.',
              },
              {
                icon: Sparkles,
                title: 'Any screen. Any network.',
                text: 'Phone, tablet or laptop. Different networks are fine — the secure server bridges the gap.',
              },
              {
                icon: LockKeyhole,
                title: 'Nothing left behind',
                text: 'Files disappear after the session. No archive, no account, no permanent cloud copy.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-[24px] border border-line/70 bg-surface/60 p-5 backdrop-blur-sm sm:p-6"
              >
                <Icon size={19} strokeWidth={1.9} className="text-brand-500 dark:text-brand-300" />
                <h3 className="mt-4 text-[14px] font-bold tracking-[-0.02em] text-ink">{title}</h3>
                <p className="mt-2 text-[12px] leading-6 text-ink-soft">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container-page pb-14 text-center">
          <p className="text-sm font-semibold text-ink">Have something to move?</p>
          <button
            type="button"
            onClick={startReceiving}
            disabled={starting}
            className="btn btn-primary mt-4"
          >
            {starting ? <LoaderCircle size={16} className="animate-spin" /> : <QrCode size={16} />}
            Open a QuickDrop
          </button>
        </section>
      </main>

      <footer className="border-t border-line/60">
        <div className="container-page flex flex-col items-center justify-between gap-5 py-8 sm:flex-row">
          <Logo showTagline />
          <p className="order-3 text-center text-[11px] font-medium text-ink-muted sm:order-none sm:text-left">
            Temporary transfers. Quietly private. Built to get out of the way.
          </p>
          <div className="flex items-center gap-4 text-[11px] font-semibold text-ink-muted">
            <a href="#how-it-works" className="transition hover:text-ink">
              How it works
            </a>
            <Link to="/" className="transition hover:text-ink">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
