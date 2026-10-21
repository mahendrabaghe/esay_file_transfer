import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clipboard,
  Copy,
  FileText,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  MonitorSmartphone,
  RotateCcw,
  Send,
  ShieldCheck,
  UploadCloud,
  Video,
  X,
} from 'lucide-react';
import ConnectionBanner from '../components/ConnectionBanner.jsx';
import FileThumb from '../components/FileThumb.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import SessionLoading from '../components/SessionLoading.jsx';
import SessionTimer from '../components/SessionTimer.jsx';
import SessionUnavailable from '../components/SessionUnavailable.jsx';
import { Toast, useToast } from '../components/Toast.jsx';
import TopBar from '../components/TopBar.jsx';
import { api } from '../lib/api.js';
import { copyText, readClipboard } from '../lib/clipboard.js';
import { ACCEPT, getFileKind, validateSelection } from '../lib/fileMeta.js';
import { formatBytes, formatSpeed, pluralize, readErrorMessage } from '../lib/format.js';
import { uploadFile } from '../lib/uploader.js';
import { useLiveSession } from '../lib/useLiveSession.js';

const TABS = [
  { id: 'photos', label: 'Photos', icon: ImageIcon },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'text', label: 'Text', icon: MessageSquareText },
  { id: 'link', label: 'Link', icon: Link2 },
];

const PICKERS = {
  photos: {
    icon: ImageIcon,
    title: 'Share photos',
    description: 'Pick a few or your whole camera roll. The original quality is kept.',
    cta: 'Choose photos',
    accept: 'image/*',
    helper: 'JPG, PNG, HEIC, WEBP and more',
  },
  videos: {
    icon: Video,
    title: 'Share videos',
    description: 'Send clips straight from your phone — no compression, no re-encoding.',
    cta: 'Choose videos',
    accept: 'video/*',
    helper: 'MP4, MOV, WEBM and more',
  },
  files: {
    icon: FileText,
    title: 'Share files',
    description: 'Documents, spreadsheets, archives and audio. Big files are chunked automatically.',
    cta: 'Choose files',
    accept: ACCEPT.documents,
    helper: 'PDF, DOCX, XLSX, ZIP, MP3 and more',
  },
};

const PENDING_STATUSES = new Set(['queued', 'error', 'cancelled']);

function normalizeLink(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function validateLink(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function FilePicker({ config, onFiles, disabled, limits }) {
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const Icon = config.icon;

  function handleDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!disabled) onFiles(event.dataTransfer.files);
  }

  return (
    <div className="surface-card p-1.5">
      <div
        className={`rounded-[23px] border border-dashed px-5 py-7 text-center transition-colors sm:px-8 sm:py-9 ${
          dragging && !disabled
            ? 'border-brand-400 bg-brand-50/70 dark:border-brand-400/50 dark:bg-brand-400/[0.08]'
            : 'border-line-strong bg-canvas/35 dark:bg-white/[0.015]'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-brand-50 text-brand-600 shadow-sm ring-1 ring-brand-100 dark:bg-brand-400/10 dark:text-brand-300 dark:ring-brand-400/15">
          <Icon size={24} strokeWidth={1.85} />
          <span className="absolute -right-1.5 -bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-brand-500 shadow-sm dark:text-brand-300">
            <Send size={10} strokeWidth={2.4} />
          </span>
        </span>

        <h2 className="mt-4 text-[19px] font-[750] tracking-[-0.03em] text-ink">{config.title}</h2>
        <p className="mx-auto mt-1.5 max-w-[330px] text-[12px] leading-5 text-ink-muted">
          {config.description}
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={config.accept}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            onFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="btn btn-primary mt-5 min-h-[50px] w-full max-w-[290px] !rounded-[17px] !text-[13.5px]"
        >
          <UploadCloud size={17} />
          {config.cta}
        </button>

        <p className="mt-3 text-[9.5px] font-medium leading-4 text-ink-muted">
          {config.helper} · Max {formatBytes(limits?.maxFileSizeBytes || 0)} per file
          <span className="hidden sm:inline"> · or drag files here</span>
        </p>
      </div>
    </div>
  );
}

function QueueItem({ item, disabled, onRemove, onCancel }) {
  const { file, status, progress, duplicate } = item;
  const percent = Math.max(0, Math.min(100, status === 'sent' ? 100 : progress?.percent || 0));
  const uploading = status === 'uploading';

  return (
    <div
      className={`rounded-2xl border p-3 transition-colors ${
        status === 'sent'
          ? 'border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-400/15 dark:bg-emerald-400/[0.045]'
          : status === 'error'
            ? 'border-rose-200/70 bg-rose-50/40 dark:border-rose-400/20 dark:bg-rose-400/[0.045]'
            : 'border-line/70 bg-canvas/40 dark:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center gap-3">
        <FileThumb
          file={file}
          iconKind={getFileKind(file.name)}
          className="h-10 w-10 shrink-0 !rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold tracking-[-0.01em] text-ink" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 text-[9.5px] font-medium text-ink-muted">
            <span className="tabular-nums">{formatBytes(file.size)}</span>
            {status === 'queued' && ' · Ready to send'}
            {status === 'uploading' &&
              ` · ${
                progress?.retrying
                  ? 'Reconnecting…'
                  : progress?.phase === 'finalizing'
                    ? 'Finishing up…'
                    : `${percent}%`
              }`}
            {status === 'sent' && (duplicate ? ' · Already in this drop' : ' · Delivered')}
            {status === 'error' && ' · Needs another try'}
            {status === 'cancelled' && ' · Paused'}
          </p>
        </div>
        {uploading ? (
          <button
            type="button"
            onClick={onCancel}
            className="icon-btn h-8 w-8 shrink-0 border border-line/70 bg-surface"
            aria-label={`Cancel upload of ${file.name}`}
          >
            <X size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="icon-btn h-8 w-8 shrink-0 border border-line/70 bg-surface disabled:opacity-40"
            aria-label={`Remove ${file.name} from the queue`}
          >
            {status === 'sent' ? (
              <Check size={14} className="text-emerald-500" strokeWidth={2.6} />
            ) : (
              <X size={14} />
            )}
          </button>
        )}
      </div>

      {uploading && (
        <div className="mt-2.5">
          <ProgressBar value={percent} className="h-1.5" animated={!progress?.retrying} />
          <div className="mt-1.5 flex items-center justify-between gap-3 text-[9px] font-semibold text-ink-muted">
            <span className="tabular-nums">
              {formatBytes(progress?.uploadedBytes || 0)} of {formatBytes(file.size)}
            </span>
            <span className="tabular-nums">
              {formatSpeed(progress?.speedBytesPerSecond) || 'Connecting…'}
            </span>
          </div>
        </div>
      )}

      {status === 'error' && item.error && (
        <p className="mt-2 flex items-start gap-1.5 text-[10px] font-medium leading-4 text-rose-700 dark:text-rose-300">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {item.error}
        </p>
      )}

      {status === 'cancelled' && (
        <p className="mt-2 text-[10px] font-medium leading-4 text-ink-muted">
          Upload paused. Send again to resume from where it stopped.
        </p>
      )}
    </div>
  );
}

function UploadQueue({
  queue,
  sending,
  onSend,
  onRemove,
  onCancel,
  onClearSent,
}) {
  const pending = queue.filter((item) => PENDING_STATUSES.has(item.status));
  const errors = queue.filter((item) => item.status === 'error').length;
  const sent = queue.filter((item) => item.status === 'sent').length;
  const pendingBytes = pending.reduce((sum, item) => sum + item.file.size, 0);

  if (!queue.length) return null;

  return (
    <section className="surface-card mt-3 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3.5">
        <div className="min-w-0">
          <p className="eyebrow">Transfer queue</p>
          <h2 className="mt-0.5 truncate text-[15px] font-[750] tracking-[-0.025em] text-ink">
            {pending.length > 0
              ? `${pluralize(pending.length, 'file')} ready`
              : 'Everything delivered'}
          </h2>
        </div>
        {sent > 0 && !sending && (
          <button
            type="button"
            onClick={onClearSent}
            className="shrink-0 text-[10.5px] font-bold text-ink-muted transition hover:text-ink"
          >
            Clear sent
          </button>
        )}
      </div>

      <div className="space-y-2 p-3 sm:p-3.5">
        {queue.map((item) => (
          <QueueItem
            key={item.key}
            item={item}
            disabled={sending}
            onRemove={() => onRemove(item.key)}
            onCancel={onCancel}
          />
        ))}
      </div>

      {pending.length > 0 ? (
        <div className="border-t border-line/70 p-3 sm:p-3.5">
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            className="btn btn-primary min-h-[52px] w-full !rounded-[17px] text-[13.5px]"
          >
            {sending ? (
              <>
                <LoaderCircle size={17} className="animate-spin" />
                Sending to laptop…
              </>
            ) : errors > 0 ? (
              <>
                <RotateCcw size={16} />
                Retry {pluralize(pending.length, 'file')} to laptop
              </>
            ) : (
              <>
                <Send size={16} />
                Send {pluralize(pending.length, 'file')} to laptop
                <span className="hidden rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold sm:inline">
                  {formatBytes(pendingBytes)}
                </span>
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[9px] font-medium text-ink-muted">
            {sending
              ? 'Keep this tab open until the transfer finishes.'
              : 'Files stay private and are removed automatically.'}
          </p>
        </div>
      ) : (
        <div className="border-t border-line/70 p-3.5">
          <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 size={13} />
            All files are on the laptop.
          </p>
        </div>
      )}
    </section>
  );
}

function RecentNotes({ notes }) {
  if (!notes.length) return null;
  return (
    <div className="border-t border-line/70 bg-emerald-50/35 px-4 py-3.5 dark:bg-emerald-400/[0.04] sm:px-5">
      <p className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.13em] text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 size={11} />
        Sent to laptop
      </p>
      <div className="mt-2 space-y-1.5">
        {notes.map((note) => (
          <div
            key={note.id}
            className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-surface/80 px-2.5 py-2 dark:border-emerald-400/15 dark:bg-white/[0.03]"
          >
            {note.type === 'link' ? (
              <Link2 size={12} className="shrink-0 text-sky-500 dark:text-sky-300" />
            ) : (
              <MessageSquareText size={12} className="shrink-0 text-amber-500 dark:text-amber-300" />
            )}
            <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-ink-soft">
              {note.content}
            </span>
            <Check size={11} className="shrink-0 text-emerald-500" strokeWidth={2.8} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SenderPage() {
  const { token } = useParams();
  const live = useLiveSession(token, 'sender');
  const { toast, show, dismiss } = useToast();
  const [tab, setTab] = useState('photos');
  const [queue, setQueue] = useState([]);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState(null);
  const [sentNotes, setSentNotes] = useState([]);
  const activeUpload = useRef(null);
  const fileKey = useRef(0);

  useEffect(() => {
    setQueue([]);
    setText('');
    setLink('');
    setSentNotes([]);
    setNoteError(null);
    return () => {
      activeUpload.current?.controller.abort();
    };
  }, [token]);

  useEffect(() => {
    if (!sending) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [sending]);

  const { session, presence, channel } = live;
  const limits = session?.limits;

  function addFiles(fileList) {
    if (!session || sending) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const { accepted, rejected } = validateSelection(files, {
      existingFiles: queue.map((item) => item.file),
      limits,
    });

    if (rejected.length) {
      show(
        rejected.length === 1
          ? rejected[0].reason
          : `${rejected.length} files were skipped. ${rejected[0].reason}`,
        'error',
      );
    }
    if (!accepted.length) return;

    const nextItems = accepted.map((file) => ({
      key: `file-${(fileKey.current += 1)}`,
      file,
      status: 'queued',
      progress: null,
      error: null,
      duplicate: false,
    }));
    setQueue((current) => [...current, ...nextItems]);
    if (accepted.length === 1) show(`${accepted[0].name} is ready to send.`, 'success');
    else show(`${accepted.length} files are ready to send.`, 'success');
  }

  async function sendQueue() {
    if (sending) return;
    const pending = queue.filter((item) => PENDING_STATUSES.has(item.status));
    if (!pending.length) return;

    setSending(true);
    let delivered = 0;
    let lastError = null;

    for (const item of pending) {
      setQueue((current) =>
        current.map((entry) =>
          entry.key === item.key
            ? { ...entry, status: 'uploading', error: null, progress: { percent: 0, phase: 'preparing' } }
            : entry,
        ),
      );
      const controller = new AbortController();
      activeUpload.current = { key: item.key, controller };

      try {
        const result = await uploadFile({
          file: item.file,
          token,
          signal: controller.signal,
          onProgress: (progress) =>
            setQueue((current) =>
              current.map((entry) =>
                entry.key === item.key ? { ...entry, progress } : entry,
              ),
            ),
        });
        delivered += 1;
        setQueue((current) =>
          current.map((entry) =>
            entry.key === item.key
              ? {
                  ...entry,
                  status: 'sent',
                  duplicate: Boolean(result.duplicate),
                  progress: { percent: 100, phase: 'complete' },
                }
              : entry,
          ),
        );
      } catch (caught) {
        if (caught?.name === 'AbortError') {
          setQueue((current) =>
            current.map((entry) =>
              entry.key === item.key
                ? { ...entry, status: 'cancelled', progress: null, error: null }
                : entry,
            ),
          );
        } else {
          const message = readErrorMessage(caught, 'That file could not be sent.');
          lastError = message;
          setQueue((current) =>
            current.map((entry) =>
              entry.key === item.key
                ? { ...entry, status: 'error', error: message, progress: null }
                : entry,
            ),
          );
          if (caught?.code === 'SESSION_EXPIRED' || caught?.status === 410) {
            live.endLocally('expired');
            break;
          }
        }
      } finally {
        activeUpload.current = null;
      }
    }

    setSending(false);
    if (delivered > 0) {
      show(
        delivered === 1
          ? 'File delivered to your laptop.'
          : `${delivered} files delivered to your laptop.`,
        'success',
      );
    } else if (lastError) {
      show(lastError, 'error');
    }
  }

  function removeItem(key) {
    if (sending) return;
    setQueue((current) => current.filter((item) => item.key !== key));
  }

  function cancelActive() {
    activeUpload.current?.controller.abort();
  }

  async function pasteClipboard(target) {
    try {
      const value = await readClipboard();
      if (target === 'link') {
        setLink(value.trim());
      } else {
        setText(value.slice(0, limits?.maxTextLength || 10000));
      }
      setNoteError(null);
      show('Pasted from clipboard.', 'success');
    } catch (caught) {
      setNoteError(caught.message);
    }
  }

  async function sendNote(type) {
    if (noteBusy || !session) return;
    let content = type === 'link' ? normalizeLink(link) : text.trim();

    if (!content) {
      setNoteError(type === 'link' ? 'Paste a link to send.' : 'Write something to send.');
      return;
    }
    if (type === 'link' && !validateLink(content)) {
      setNoteError('Enter a complete link beginning with https:// or http://.');
      return;
    }
    if (type === 'text' && content.length > limits.maxTextLength) {
      content = content.slice(0, limits.maxTextLength);
    }

    setNoteBusy(true);
    setNoteError(null);
    try {
      await api.sendMessage(token, type, content);
      setSentNotes((current) =>
        [
          { id: `note-${Date.now()}-${Math.random()}`, type, content, createdAt: Date.now() },
          ...current,
        ].slice(0, 4),
      );
      if (type === 'link') setLink('');
      else setText('');
      show(type === 'link' ? 'Link sent to your laptop.' : 'Note sent to your laptop.', 'success');
    } catch (caught) {
      const message = readErrorMessage(caught, 'That message could not be sent.');
      if (caught?.code === 'SESSION_EXPIRED' || caught?.status === 410) {
        live.endLocally('expired');
      } else {
        setNoteError(message);
        show(message, 'error');
      }
    } finally {
      setNoteBusy(false);
    }
  }

  async function copyCode() {
    const success = await copyText(session?.code || '');
    show(
      success ? 'Session code copied.' : 'Could not copy the session code.',
      success ? 'success' : 'error',
    );
  }

  if (live.phase === 'ended') return <SessionUnavailable kind={live.endReason} />;
  if (live.phase === 'not-found') return <SessionUnavailable kind="not-found" />;
  if (live.phase === 'invalid-link') return <SessionUnavailable kind="invalid-link" />;
  if (live.phase === 'error') {
    return <SessionUnavailable kind="error" error={live.error} onRetry={live.refresh} />;
  }
  if (live.phase === 'loading' || !session) {
    return <SessionLoading label="Opening your private link…" />;
  }

  const connected = channel === 'connected';
  const receiverReady = connected && (presence?.receivers || 0) > 0;
  const statusLabel = !connected
    ? channel === 'reconnecting'
      ? 'Reconnecting…'
      : 'Connecting…'
    : receiverReady
      ? 'Laptop connected'
      : 'Drop is open';
  const maxTextLength = limits?.maxTextLength || 10000;
  const recentText = sentNotes.filter((note) => note.type === 'text');
  const recentLinks = sentNotes.filter((note) => note.type === 'link');
  const isFileTab = ['photos', 'videos', 'files'].includes(tab);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        right={
          <span className="hidden items-center gap-1.5 text-[11px] font-semibold text-ink-muted sm:inline-flex">
            <LockKeyhole size={12} className="text-emerald-500" />
            Private link
          </span>
        }
      />
      <ConnectionBanner visible={channel === 'reconnecting'} />

      <main className="container-page w-full flex-1 pb-8 pt-5 sm:pt-7">
        <div className="mx-auto w-full max-w-[720px]">
          <header className="animate-fade-up">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`pill ${
                      connected
                        ? 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300'
                        : 'border-amber-200/70 bg-amber-50/80 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300'
                    }`}
                  >
                    {connected ? (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-500" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                    ) : (
                      <LoaderCircle size={11} className="animate-spin" />
                    )}
                    {statusLabel}
                  </span>
                  <span className="pill hidden sm:inline-flex">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    Temporary session
                  </span>
                </div>

                <h1 className="mt-4 text-[clamp(2.1rem,7vw,2.85rem)] font-[750] leading-[1.02] tracking-[-0.05em] text-ink">
                  Send to your <span className="text-gradient">laptop.</span>
                </h1>
                <p className="mt-2 max-w-[440px] text-[13px] leading-6 text-ink-soft">
                  Choose what to share. It lands on the receiving screen in seconds — no app, no
                  account.
                </p>
              </div>
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-[19px] border border-brand-100 bg-brand-50 text-brand-600 shadow-sm sm:flex dark:border-brand-400/15 dark:bg-brand-400/10 dark:text-brand-300">
                <MonitorSmartphone size={23} strokeWidth={1.8} />
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line/70 bg-surface/65 px-3.5 py-2.5 backdrop-blur-sm">
              <button
                type="button"
                onClick={copyCode}
                className="group inline-flex items-center gap-1.5 rounded-lg text-[10.5px] font-semibold text-ink-soft transition hover:text-ink"
                title="Copy session code"
              >
                <span className="text-[8.5px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">
                  Session
                </span>
                <span className="font-mono text-[11px] font-bold tracking-[0.01em] text-ink">
                  {session.code}
                </span>
                <Copy size={11} className="text-ink-muted transition group-hover:text-ink" />
              </button>
              <span className="hidden h-3.5 w-px bg-line sm:block" />
              <SessionTimer expiresAt={session.expiresAt} />
              <span className="ml-auto hidden items-center gap-1.5 text-[9.5px] font-semibold text-ink-muted sm:inline-flex">
                <LockKeyhole size={10} />
                Auto-deleted
              </span>
            </div>
          </header>

          <div
            role="tablist"
            aria-label="What would you like to send?"
            className="mt-4 flex animate-fade-up gap-1 overflow-x-auto rounded-[18px] border border-line/70 bg-surface/70 p-1.5 shadow-sm backdrop-blur-sm no-scrollbar [animation-delay:60ms]"
          >
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${id}`}
                  onClick={() => {
                    setTab(id);
                    setNoteError(null);
                  }}
                  className={`flex min-w-[54px] flex-1 flex-col items-center justify-center gap-1 rounded-[13px] px-1.5 py-2 text-[9.5px] font-bold leading-none transition sm:min-w-0 sm:flex-row sm:gap-1.5 sm:py-2.5 sm:text-[11px] ${
                    active
                      ? 'bg-ink text-canvas shadow-sm'
                      : 'text-ink-muted hover:bg-subtle hover:text-ink'
                  }`}
                >
                  <Icon size={15} strokeWidth={2} />
                  {label}
                </button>
              );
            })}
          </div>

          <div
            id={`panel-${tab}`}
            role="tabpanel"
            className="mt-3 animate-fade-in"
            key={tab}
          >
            {isFileTab && (
              <FilePicker
                config={PICKERS[tab]}
                onFiles={addFiles}
                disabled={sending}
                limits={limits}
              />
            )}

            {tab === 'text' && (
              <section className="surface-card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line/70 px-4 py-4 sm:px-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300">
                    <MessageSquareText size={18} strokeWidth={1.9} />
                  </span>
                  <div>
                    <p className="eyebrow">Text note</p>
                    <h2 className="mt-0.5 text-[16px] font-[750] tracking-[-0.025em] text-ink">
                      Send a message or code
                    </h2>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="quickdrop-note"
                      className="text-[10.5px] font-bold text-ink-soft"
                    >
                      Your note
                    </label>
                    <button
                      type="button"
                      onClick={() => pasteClipboard('text')}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 text-[10px] font-bold text-ink-soft transition hover:border-line-strong hover:text-ink"
                    >
                      <Clipboard size={11} />
                      Paste
                    </button>
                  </div>
                  <textarea
                    id="quickdrop-note"
                    rows={6}
                    value={text}
                    maxLength={maxTextLength}
                    onChange={(event) => {
                      setText(event.target.value);
                      if (noteError) setNoteError(null);
                    }}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        event.preventDefault();
                        sendNote('text');
                      }
                    }}
                    placeholder="Paste a WiFi password, an address, a code — anything you can type or paste."
                    className="input-base mt-2 min-h-[156px] resize-none text-[13.5px] leading-6"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] font-medium text-ink-muted">
                    <span className="tabular-nums">
                      {text.length.toLocaleString()} / {maxTextLength.toLocaleString()}
                    </span>
                    <span className="hidden sm:inline">Ctrl / ⌘ + Enter to send</span>
                  </div>

                  {noteError && tab === 'text' && (
                    <p
                      role="alert"
                      className="mt-2 flex items-start gap-1.5 rounded-xl border border-rose-200/70 bg-rose-50 px-3 py-2 text-[10.5px] font-medium leading-4 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
                    >
                      <AlertCircle size={13} className="mt-0.5 shrink-0" />
                      {noteError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => sendNote('text')}
                    disabled={!text.trim() || noteBusy}
                    className="btn btn-primary mt-4 min-h-[52px] w-full !rounded-[17px] text-[13.5px]"
                  >
                    {noteBusy ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    Send text to laptop
                  </button>
                </div>
                <RecentNotes notes={recentText} />
              </section>
            )}

            {tab === 'link' && (
              <section className="surface-card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line/70 px-4 py-4 sm:px-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300">
                    <Link2 size={18} strokeWidth={1.9} />
                  </span>
                  <div>
                    <p className="eyebrow">Link</p>
                    <h2 className="mt-0.5 text-[16px] font-[750] tracking-[-0.025em] text-ink">
                      Share a link
                    </h2>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="quickdrop-link"
                      className="text-[10.5px] font-bold text-ink-soft"
                    >
                      Web address
                    </label>
                    <button
                      type="button"
                      onClick={() => pasteClipboard('link')}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 text-[10px] font-bold text-ink-soft transition hover:border-line-strong hover:text-ink"
                    >
                      <Clipboard size={11} />
                      Paste
                    </button>
                  </div>
                  <input
                    id="quickdrop-link"
                    type="url"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={link}
                    onChange={(event) => {
                      setLink(event.target.value);
                      if (noteError) setNoteError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        sendNote('link');
                      }
                    }}
                    placeholder="https://example.com/your-link"
                    className="input-base mt-2 text-[13.5px]"
                  />
                  <p className="mt-2 text-[9.5px] leading-4 text-ink-muted">
                    Opens as a clickable link on the receiving screen. Only http and https links are
                    supported.
                  </p>

                  {noteError && tab === 'link' && (
                    <p
                      role="alert"
                      className="mt-2 flex items-start gap-1.5 rounded-xl border border-rose-200/70 bg-rose-50 px-3 py-2 text-[10.5px] font-medium leading-4 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
                    >
                      <AlertCircle size={13} className="mt-0.5 shrink-0" />
                      {noteError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => sendNote('link')}
                    disabled={!link.trim() || noteBusy}
                    className="btn btn-primary mt-4 min-h-[52px] w-full !rounded-[17px] text-[13.5px]"
                  >
                    {noteBusy ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    Send link to laptop
                  </button>
                </div>
                <RecentNotes notes={recentLinks} />
              </section>
            )}
          </div>

          <UploadQueue
            queue={queue}
            sending={sending}
            onSend={sendQueue}
            onRemove={removeItem}
            onCancel={cancelActive}
            onClearSent={() =>
              setQueue((current) => current.filter((item) => item.status !== 'sent'))
            }
          />

          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-2 text-center text-[9.5px] font-medium text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <LockKeyhole size={10} />
              Private tokens
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={10} className="text-emerald-500" />
              Original quality
            </span>
            <span className="inline-flex items-center gap-1">
              <Send size={10} />
              No app needed
            </span>
          </p>
        </div>
      </main>

      <footer className="border-t border-line/60">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-center text-[10px] font-medium text-ink-muted sm:flex-row sm:text-left">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-emerald-500" />
            Files delete automatically after this drop closes.
          </span>
          <span>QuickDrop · Scan. Share. Done.</span>
        </div>
      </footer>

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
