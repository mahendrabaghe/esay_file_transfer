import { Link } from 'react-router-dom';
import { ArrowLeft, QrCode, ScanLine } from 'lucide-react';
import TopBar from '../components/TopBar.jsx';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="container-page flex flex-1 items-center justify-center py-16 sm:py-20">
        <div className="max-w-[520px] animate-fade-up text-center">
          <div className="relative mx-auto w-fit">
            <span className="absolute inset-0 -z-10 animate-pulse-ring rounded-[26px] bg-brand-400/15" />
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[26px] border border-brand-100 bg-brand-50 text-brand-600 shadow-sm dark:border-brand-400/15 dark:bg-brand-400/10 dark:text-brand-300">
              <ScanLine size={28} strokeWidth={1.8} />
            </span>
          </div>
          <p className="eyebrow mt-7">404 · Wrong turn</p>
          <h1 className="mt-3 text-[clamp(2.2rem,6vw,3.3rem)] font-[750] leading-[1.02] tracking-[-0.055em] text-ink">
            Nothing dropped here.
          </h1>
          <p className="mx-auto mt-4 max-w-[420px] text-[14px] leading-7 text-ink-soft">
            This page doesn&apos;t exist. If you were looking for a drop, open a fresh one on your
            laptop and scan its QR code.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
            <Link to="/" className="btn btn-primary btn-lg">
              <QrCode size={17} />
              Open a QuickDrop
            </Link>
            <Link to="/" className="btn btn-secondary btn-lg">
              <ArrowLeft size={16} />
              Back home
            </Link>
          </div>
        </div>
      </main>
      <footer className="container-page pb-8 text-center text-[11px] font-medium text-ink-muted">
        QuickDrop · Scan. Share. Done.
      </footer>
    </div>
  );
}
