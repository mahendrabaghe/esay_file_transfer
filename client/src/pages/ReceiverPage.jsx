import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Download,
  Laptop,
  LockKeyhole,
  Power,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ConnectionBanner from '../components/ConnectionBanner.jsx';
import QRCodePanel from '../components/QRCodePanel.jsx';
import ReceivedPanel from '../components/ReceivedPanel.jsx';
import SessionLoading from '../components/SessionLoading.jsx';
import SessionStatus from '../components/SessionStatus.jsx';
import SessionUnavailable from '../components/SessionUnavailable.jsx';
import { Toast, useToast } from '../components/Toast.jsx';
import TopBar from '../components/TopBar.jsx';
import { api } from '../lib/api.js';
import { readErrorMessage } from '../lib/format.js';
import { useLiveSession } from '../lib/useLiveSession.js';

const TIPS = [
  {
    icon: Laptop,
    title: 'Keep this tab open',
    text: 'Incoming files appear here the moment they arrive.',
    tone: 'bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300',
  },
  {
    icon: Download,
    title: 'Download all at once',
    text: 'Grab a ZIP of the whole drop, or save files one by one.',
    tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300',
  },
];

export default function ReceiverPage() {
  const { token } = useParams();
  const live = useLiveSession(token, 'receiver');
  const { toast, show, dismiss } = useToast();
  const [stopOpen, setStopOpen] = useState(false);
  const [stopping, setStopping] = useState(false);

  async function stopSharing() {
    if (stopping) return;
    setStopping(true);
    try {
      await api.stopSession(token);
      live.endLocally('stopped');
    } catch (caught) {
      if (caught?.status === 410) {
        live.endLocally('expired');
      } else if (caught?.status === 404) {
        live.endLocally('stopped');
      } else {
        show(readErrorMessage(caught, 'Could not stop this drop. Please try again.'), 'error');
      }
    } finally {
      setStopping(false);
      setStopOpen(false);
    }
  }

  if (live.phase === 'ended') return <SessionUnavailable kind={live.endReason} />;
  if (live.phase === 'not-found') return <SessionUnavailable kind="not-found" />;
  if (live.phase === 'invalid-link') return <SessionUnavailable kind="invalid-link" />;
  if (live.phase === 'error') {
    return <SessionUnavailable kind="error" error={live.error} onRetry={live.refresh} />;
  }
  if (live.phase === 'loading' || !live.session) {
    return <SessionLoading label="Opening your private drop…" />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        right={
          <span className="hidden items-center gap-1.5 text-[11px] font-semibold text-ink-muted sm:inline-flex">
            <ShieldCheck size={13} className="text-emerald-500" />
            Private session
          </span>
        }
      />
      <ConnectionBanner visible={live.channel === 'reconnecting'} />

      <main className="container-page flex-1 pb-14 pt-6 sm:pt-8">
        <header className="flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill border-brand-200/70 bg-brand-50/70 text-brand-700 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200">
                <Laptop size={13} />
                Receiving on this laptop
              </span>
              <SessionStatus presence={live.presence} channel={live.channel} />
            </div>
            <h1 className="mt-4 text-[clamp(2.15rem,4.2vw,3.15rem)] font-[750] leading-[1.02] tracking-[-0.05em] text-ink">
              Ready when you are<span className="text-brand-500">.</span>
            </h1>
            <p className="mt-2 max-w-[520px] text-[13.5px] leading-6 text-ink-soft">
              Scan the code with your phone — or drop files here from this laptop. Everything arrives
              live, then disappears when you&apos;re done.
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-2 rounded-2xl border border-line/70 bg-surface/60 px-3.5 py-2.5 text-[10.5px] font-semibold text-ink-muted backdrop-blur sm:flex">
            <ScanLine size={13} className="text-brand-500 dark:text-brand-300" />
            No app · No account · No leftovers
          </div>
        </header>

        <div className="mt-7 grid items-start gap-4 lg:grid-cols-[minmax(340px,396px)_minmax(0,1fr)] xl:gap-6">
          <aside className="space-y-3.5">
            <QRCodePanel
              sharePath={live.sharePath}
              session={live.session}
              presence={live.presence}
              channel={live.channel}
              onStop={() => setStopOpen(true)}
              showToast={show}
            />

            <div className="rounded-[24px] border border-line/70 bg-surface/55 p-4 backdrop-blur-sm">
              <p className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.15em] text-ink-muted">
                <Sparkles size={11} className="text-brand-500 dark:text-brand-300" />
                Good to know
              </p>
              <ul className="mt-3 space-y-3">
                {TIPS.map(({ icon: Icon, title, text, tone }) => (
                  <li key={title} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}
                    >
                      <Icon size={13} strokeWidth={2.1} />
                    </span>
                    <span className="text-[11px] leading-[1.15rem] text-ink-muted">
                      <strong className="font-bold text-ink-soft">{title}.</strong> {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <ReceivedPanel
            token={token}
            session={live.session}
            files={live.files}
            messages={live.messages}
            transfers={live.transfers}
            onUploaded={live.upsertFile}
            onExpired={() => live.endLocally('expired')}
            showToast={show}
          />
        </div>
      </main>

      <footer className="border-t border-line/60">
        <div className="container-page flex flex-col items-center justify-between gap-2.5 py-6 text-[10.5px] font-medium text-ink-muted sm:flex-row">
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole size={11} />
            Temporary session · files clean up automatically
          </span>
          <span>QuickDrop · Scan. Share. Done.</span>
        </div>
      </footer>

      <ConfirmDialog
        open={stopOpen}
        title="Stop sharing this drop?"
        description="The QR code will stop working and every file and note in this session will be deleted right away. This can't be undone."
        confirmLabel="Stop sharing"
        cancelLabel="Keep sharing"
        danger
        busy={stopping}
        icon={Power}
        onCancel={() => setStopOpen(false)}
        onConfirm={stopSharing}
      />

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
