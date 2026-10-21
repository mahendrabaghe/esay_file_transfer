import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FolderOpen,
  Link2,
  LoaderCircle,
  MessageSquareText,
  ScanLine,
  Smartphone,
  StickyNote,
  X,
} from 'lucide-react';
import { apiUrl } from '../lib/api.js';
import { copyText } from '../lib/clipboard.js';
import { formatBytes, formatClock, pluralize } from '../lib/format.js';
import FileIcon from './FileIcon.jsx';
import LocalDropZone from './LocalDropZone.jsx';
import ProgressBar from './ProgressBar.jsx';

function totalSize(files) {
  return files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
}

function linkDomain(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}

function ImageTile({ file, onOpen }) {
  const [failed, setFailed] = useState(false);
  const downloadHref = apiUrl(file.downloadPath);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onOpen(file)}
        className="block aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line/70 bg-subtle text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20"
        aria-label={`Preview ${file.name}`}
      >
        {failed ? (
          <span className="flex h-full w-full items-center justify-center">
            <FileIcon kind="image" size="lg" />
          </span>
        ) : (
          <img
            src={apiUrl(file.previewPath)}
            alt=""
            loading="lazy"
            draggable="false"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.035]"
          />
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0c0b17]/80 via-[#0c0b17]/5 to-transparent" />
        <span className="absolute bottom-2.5 left-3 right-11 min-w-0">
          <span className="block truncate text-[11px] font-bold text-white">{file.name}</span>
          <span className="mt-0.5 block text-[9.5px] font-medium text-white/65">
            {formatBytes(file.size)}
          </span>
        </span>
      </button>
      <a
        href={downloadHref}
        className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white opacity-90 backdrop-blur transition hover:bg-white/20 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label={`Download ${file.name}`}
      >
        <Download size={12} />
      </a>
    </div>
  );
}

function OtherFileRow({ file }) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-line/70 bg-canvas/45 p-3 transition-colors hover:border-line-strong hover:bg-raised dark:bg-white/[0.02]">
      <FileIcon kind={file.kind} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold tracking-[-0.01em] text-ink" title={file.name}>
          {file.name}
        </p>
        <p className="mt-0.5 text-[10px] font-medium text-ink-muted">
          {formatBytes(file.size)} · {file.source === 'laptop' ? 'From this laptop' : 'From phone'} ·{' '}
          {formatClock(file.createdAt)}
        </p>
      </div>
      <a
        href={apiUrl(file.downloadPath)}
        className="icon-btn h-9 w-9 shrink-0 border border-line/70 bg-surface"
        aria-label={`Download ${file.name}`}
        download={file.name}
      >
        <Download size={15} />
      </a>
    </div>
  );
}

function NoteCard({ message, showToast }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isLink = message.type === 'link';
  const isLong = message.content.length > 340 || message.content.split('\n').length > 6;

  async function copy() {
    const success = await copyText(message.content);
    if (success) {
      setCopied(true);
      showToast?.('Copied to clipboard.', 'success');
      setTimeout(() => setCopied(false), 1600);
    } else {
      showToast?.('Could not copy. Select the text and copy it manually.', 'error');
    }
  }

  return (
    <article className="rounded-2xl border border-line/70 bg-canvas/40 p-3.5 dark:bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            isLink
              ? 'bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300'
          }`}
        >
          {isLink ? <Link2 size={16} strokeWidth={2} /> : <StickyNote size={16} strokeWidth={2} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">
              {isLink ? 'Link' : 'Note'} · {formatClock(message.createdAt)}
            </p>
            <button
              type="button"
              onClick={copy}
              className="icon-btn h-7 w-7"
              aria-label={copied ? 'Copied' : 'Copy message'}
            >
              {copied ? (
                <Check size={13} className="text-emerald-500" strokeWidth={2.6} />
              ) : (
                <Copy size={13} />
              )}
            </button>
          </div>

          {isLink ? (
            <>
              <a
                href={message.href || message.content}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-semibold leading-5 text-brand-700 underline decoration-brand-300/60 underline-offset-2 transition hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
              >
                <span className="break-all">{message.content}</span>
                <ExternalLink size={12} className="mt-1 shrink-0" />
              </a>
              <p className="mt-1 text-[10px] font-medium text-ink-muted">
                {linkDomain(message.href || message.content)}
              </p>
            </>
          ) : (
            <>
              <p
                className={`mt-1.5 whitespace-pre-wrap break-words text-[12.5px] leading-5 text-ink-soft ${
                  !expanded && isLong ? 'line-clamp-6' : ''
                }`}
              >
                {message.content}
              </p>
              {isLong && (
                <button
                  type="button"
                  onClick={() => setExpanded((current) => !current)}
                  className="mt-1.5 text-[10.5px] font-bold text-brand-600 hover:underline dark:text-brand-300"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function Lightbox({ file, onClose }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex animate-fade-in flex-col bg-[#08080f]/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${file.name}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-white">{file.name}</p>
          <p className="mt-0.5 text-[10.5px] font-medium text-white/45">{formatBytes(file.size)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={apiUrl(file.downloadPath)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-[12px] font-semibold text-white transition hover:bg-white/20"
            download={file.name}
          >
            <Download size={14} />
            <span className="hidden sm:inline">Download</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close preview"
          >
            <X size={19} />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-8">
        <button
          type="button"
          className="absolute inset-0 cursor-zoom-out"
          onClick={onClose}
          aria-label="Close preview"
        />
        {failed ? (
          <div className="relative z-10 flex flex-col items-center gap-3 text-center text-white/65">
            <FileIcon kind="image" size="lg" />
            <p className="max-w-[280px] text-xs leading-5">
              This image format can&apos;t be previewed in your browser. You can still download it.
            </p>
          </div>
        ) : (
          <img
            src={apiUrl(file.previewPath)}
            alt={file.name}
            draggable="false"
            onError={() => setFailed(true)}
            className="relative z-10 max-h-full max-w-full rounded-2xl object-contain shadow-float"
          />
        )}
      </div>

      <p className="pb-5 text-center text-[10px] font-medium text-white/35">
        Tap outside the image or press Esc to close
      </p>
    </div>,
    document.body,
  );
}

export default function ReceivedPanel({
  token,
  session,
  files,
  messages,
  transfers,
  onUploaded,
  onExpired,
  showToast,
}) {
  const [preview, setPreview] = useState(null);

  const orderedFiles = useMemo(
    () => [...files].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0)),
    [files],
  );
  const images = useMemo(
    () => orderedFiles.filter((file) => file.kind === 'image' && file.previewPath),
    [orderedFiles],
  );
  const otherFiles = useMemo(
    () => orderedFiles.filter((file) => !(file.kind === 'image' && file.previewPath)),
    [orderedFiles],
  );
  const orderedMessages = useMemo(
    () => [...messages].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0)),
    [messages],
  );
  const bytes = totalSize(files);

  return (
    <div className="space-y-4">
      <section className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-brand-50 text-brand-600 dark:bg-brand-400/10 dark:text-brand-300">
              <FolderOpen size={20} strokeWidth={1.9} />
              {files.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-extrabold text-white shadow-sm">
                  {files.length > 99 ? '99+' : files.length}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="eyebrow">Live destination</p>
              <h2 className="mt-0.5 text-[18px] font-[750] tracking-[-0.03em] text-ink">
                Received files
              </h2>
              <p className="mt-0.5 text-[10.5px] font-medium text-ink-muted">
                {files.length > 0
                  ? `${pluralize(files.length, 'file')} · ${formatBytes(bytes)}`
                  : 'Nothing here yet'}
              </p>
            </div>
          </div>

          {files.length > 0 && (
            <a
              href={apiUrl(`/api/sessions/${encodeURIComponent(token)}/archive`)}
              className="btn btn-primary !px-4 !py-2.5 text-[11.5px]"
              onClick={() =>
                showToast?.('Building your ZIP. The download starts in a moment.', 'info')
              }
            >
              <FileArchive size={14} />
              Download all
            </a>
          )}
        </div>

        <div className="border-b border-line/70 px-4 py-3.5 sm:px-6">
          <LocalDropZone
            token={token}
            limits={session?.limits}
            usage={session?.usage}
            onUploaded={onUploaded}
            onExpired={onExpired}
            showToast={showToast}
          />
        </div>

        {transfers.length > 0 && (
          <div className="space-y-2.5 border-b border-line/70 bg-brand-50/40 px-4 py-4 sm:px-6 dark:bg-brand-400/[0.04]">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">
                Arriving now
              </p>
              <span className="flex items-center gap-1.5 text-[9.5px] font-semibold text-ink-muted">
                <LoaderCircle size={11} className="animate-spin" />
                Live
              </span>
            </div>
            {transfers.map((transfer) => (
              <div
                key={transfer.uploadId}
                className="rounded-xl border border-brand-200/60 bg-surface/85 p-3 dark:border-brand-400/15 dark:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[11px] font-bold text-ink">
                    {transfer.name}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-brand-700 dark:text-brand-300">
                    {transfer.percent || 0}%
                  </span>
                </div>
                <ProgressBar value={transfer.percent || 0} className="mt-2 h-1.5" animated={false} />
                <div className="mt-1.5 flex items-center justify-between gap-3 text-[9.5px] font-medium text-ink-muted">
                  <span className="tabular-nums">
                    {formatBytes(transfer.receivedBytes || 0)} of{' '}
                    {formatBytes(transfer.totalBytes || 0)}
                  </span>
                  <span>Encrypted in transit</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {files.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center sm:py-14">
            <div className="relative">
              <span className="absolute inset-0 animate-pulse-ring rounded-[24px] bg-brand-400/20" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-[24px] border border-brand-100 bg-brand-50 text-brand-500 shadow-sm dark:border-brand-400/15 dark:bg-brand-400/10 dark:text-brand-300">
                <Smartphone size={25} strokeWidth={1.8} />
              </span>
              <span className="absolute -bottom-1 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow-sm">
                <ScanLine size={13} />
              </span>
            </div>
            <h3 className="mt-6 text-[16px] font-bold tracking-[-0.025em] text-ink">
              Waiting for your first file.
            </h3>
            <p className="mt-2 max-w-[330px] text-[12px] leading-5 text-ink-muted">
              Scan the QR code above with your phone, then send photos, videos, documents or a note.
              Everything lands here instantly.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {['Photos', 'Videos', 'Documents', 'Text & links'].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-line/80 bg-canvas/60 px-2.5 py-1 text-[9.5px] font-semibold text-ink-muted"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {images.map((file) => (
                  <ImageTile key={file.id} file={file} onOpen={setPreview} />
                ))}
              </div>
            )}
            {otherFiles.length > 0 && (
              <div className={`space-y-2 ${images.length > 0 ? 'mt-3' : ''}`}>
                {otherFiles.map((file) => (
                  <OtherFileRow key={file.id} file={file} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300">
              <MessageSquareText size={18} strokeWidth={1.9} />
            </span>
            <div>
              <p className="eyebrow">From your phone</p>
              <h2 className="mt-0.5 text-[16px] font-[750] tracking-[-0.025em] text-ink">
                Notes &amp; links
              </h2>
            </div>
          </div>
          {messages.length > 0 && (
            <span className="pill !px-2.5 !py-1 text-[10px]">{messages.length}</span>
          )}
        </div>

        {orderedMessages.length === 0 ? (
          <p className="px-4 py-6 text-center text-[11.5px] leading-5 text-ink-muted sm:px-6">
            Paste text or a link on your phone and it will appear here, ready to copy.
          </p>
        ) : (
          <div className="space-y-2.5 p-4 sm:p-5">
            {orderedMessages.map((message) => (
              <NoteCard key={message.id} message={message} showToast={showToast} />
            ))}
          </div>
        )}
      </section>

      {preview && <Lightbox file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
