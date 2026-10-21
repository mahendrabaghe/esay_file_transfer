import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  Check,
  Copy,
  Link2,
  LoaderCircle,
  LockKeyhole,
  QrCode,
  Square,
} from 'lucide-react';
import { IS_LOCALHOST, resolveShareOrigin, shareUrl } from '../lib/api.js';
import { copyText } from '../lib/clipboard.js';
import SessionStatus from './SessionStatus.jsx';
import SessionTimer from './SessionTimer.jsx';

export default function QRCodePanel({
  sharePath,
  session,
  presence,
  channel,
  onStop,
  showToast,
}) {
  const [qr, setQr] = useState(null);
  const [qrError, setQrError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [shareOrigin, setShareOrigin] = useState(null);
  const link = shareOrigin ? shareUrl(sharePath, shareOrigin) : '';
  const lanReady = IS_LOCALHOST && shareOrigin && shareOrigin !== window.location.origin;
  const lanUnavailable = IS_LOCALHOST && shareOrigin === window.location.origin;

  useEffect(() => {
    let cancelled = false;
    resolveShareOrigin().then((origin) => {
      if (!cancelled) setShareOrigin(origin);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    setQrError(null);
    if (!link) return undefined;

    QRCode.toDataURL(link, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 720,
      color: { dark: '#191a29', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrError('The QR code could not be drawn. Copy the invite link instead.');
      });

    return () => {
      cancelled = true;
    };
  }, [link]);

  async function copy(value, type) {
    const success = await copyText(value);
    if (success) {
      setCopied(type);
      showToast?.(type === 'id' ? 'Session ID copied.' : 'Invite link copied.', 'success');
      setTimeout(() => setCopied(null), 1800);
    } else {
      showToast?.('Could not copy. Select the value and copy it manually.', 'error');
    }
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Scan to connect</p>
          <h2 className="mt-1.5 text-[19px] font-[750] tracking-[-0.035em] text-ink">
            Your drop is open.
          </h2>
        </div>
        <span className="pill shrink-0 border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-[28px] border border-brand-100/70 bg-[linear-gradient(160deg,#f4f1ff_0%,#f8f7ff_50%,#eff7ff_100%)] p-4 dark:border-brand-400/10 dark:bg-[linear-gradient(160deg,rgba(120,98,244,0.14),rgba(18,19,31,0.4))]">
        <div
          className="pointer-events-none absolute inset-0 opacity-50 dot-pattern dark:opacity-30"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-[292px]">
          <div className="qr-frame">
            <div className="qr-stage aspect-square">
              {qr ? (
                <img
                  src={qr}
                  alt={`QR code to send files to QuickDrop session ${session.code}`}
                  className="h-full w-full select-none"
                  draggable="false"
                />
              ) : qrError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-7 text-center">
                  <AlertCircle size={26} className="text-rose-500" />
                  <p className="text-xs font-semibold leading-5 text-ink-soft">{qrError}</p>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <LoaderCircle size={26} className="animate-spin text-brand-400" />
                </div>
              )}
              <span className="qr-scan-line" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      <h3 className="mx-auto mt-5 max-w-[320px] text-center text-[16px] font-[750] leading-6 tracking-[-0.025em] text-ink">
        Scan this QR code with your phone to share files.
      </h3>
      <p className="mx-auto mt-1.5 max-w-[300px] text-center text-[12px] leading-5 text-ink-muted">
        Open your camera app, point at the code, and tap the link. No app needed.
      </p>

      <div className="mt-5 rounded-2xl border border-line/80 bg-subtle/55 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-ink-muted">
              Session ID
            </p>
            <p className="mt-1 truncate font-mono text-[12px] font-bold tracking-[0.02em] text-ink">
              {session.code}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn h-8 w-8 border border-line/70 bg-surface"
            onClick={() => copy(session.code, 'id')}
            aria-label="Copy session ID"
          >
            {copied === 'id' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line/70 pt-3">
          <SessionStatus presence={presence} channel={channel} />
          <SessionTimer expiresAt={session.expiresAt} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn btn-secondary !px-3 text-[12px]"
          onClick={() => copy(link, 'link')}
          disabled={!link}
        >
          {copied === 'link' ? <Check size={14} className="text-emerald-500" /> : <Link2 size={14} />}
          Copy link
        </button>
        <button type="button" className="btn btn-danger !px-3 text-[12px]" onClick={onStop}>
          <Square size={12} fill="currentColor" />
          Stop sharing
        </button>
      </div>

      <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[10px] font-medium text-ink-muted">
        <LockKeyhole size={11} />
        Private session · files delete automatically
      </div>

      {lanReady && (
        <div className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50 px-3 py-2 text-[10px] leading-4 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
          <span className="font-bold">Phone-ready link.</span> This QR uses{' '}
          <code className="font-semibold">{shareOrigin.replace(/^https?:\/\//, '')}</code>. Keep both
          devices on the same network.
        </div>
      )}

      {lanUnavailable && (
        <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          <span className="font-bold">No LAN address detected.</span> A phone can&apos;t open
          localhost. Set <code className="font-semibold">VITE_PUBLIC_APP_URL</code> to your
          computer&apos;s LAN address.
        </div>
      )}

      {!qr && !qrError && (
        <span className="sr-only">
          Generating QR code
          <QrCode />
        </span>
      )}
    </div>
  );
}
