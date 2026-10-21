import { useRef, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, UploadCloud } from 'lucide-react';
import { ALLOWED_EXTENSIONS } from '../lib/fileMeta.js';
import { validateSelection } from '../lib/fileMeta.js';
import { formatBytes, formatSpeed, readErrorMessage } from '../lib/format.js';
import { uploadFile } from '../lib/uploader.js';
import ProgressBar from './ProgressBar.jsx';

const ACCEPT_ALL = [...ALLOWED_EXTENSIONS].map((extension) => `.${extension}`).join(',');

export default function LocalDropZone({
  token,
  limits,
  usage,
  variant = 'compact',
  onUploaded,
  onExpired,
  showToast,
}) {
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [error, setError] = useState(null);

  const remainingSlots = Math.max(0, (limits?.maxFilesPerSession || Infinity) - (usage?.files || 0));
  const remainingBytes = Math.max(0, (limits?.maxSessionBytes || Infinity) - (usage?.bytes || 0));

  async function handleFiles(fileList) {
    if (busy) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError(null);

    if (remainingSlots <= 0) {
      setError('This drop has reached its file limit.');
      return;
    }

    const { accepted, rejected } = validateSelection(files, {
      limits: {
        ...limits,
        maxFilesPerSession: remainingSlots,
      },
    });
    let usedBytes = 0;
    const queue = accepted.filter((file) => {
      if (usedBytes + file.size > remainingBytes) {
        rejected.push({ file, reason: `${file.name} does not fit in the remaining session space.` });
        return false;
      }
      usedBytes += file.size;
      return true;
    });

    if (rejected.length) {
      const message =
        rejected.length === 1
          ? rejected[0].reason
          : `${rejected.length} files were skipped. ${rejected[0].reason}`;
      setError(message);
      showToast?.(message, 'error');
    }
    if (!queue.length) return;

    setBusy(true);
    let succeeded = 0;
    try {
      for (const file of queue) {
        setCurrentFile(file);
        const result = await uploadFile({
          file,
          token,
          onProgress: setProgress,
        });
        if (!result.duplicate && result.file) onUploaded?.(result.file);
        succeeded += 1;
      }
      showToast?.(
        succeeded === 1 ? 'File added to this drop.' : `${succeeded} files added to this drop.`,
        'success',
      );
    } catch (caught) {
      setError(readErrorMessage(caught, 'That file could not be added.'));
      if (caught?.code === 'SESSION_EXPIRED' || caught?.status === 410) {
        onExpired?.();
      }
    } finally {
      setBusy(false);
      setCurrentFile(null);
      setProgress(null);
    }
  }

  function onDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!busy) handleFiles(event.dataTransfer.files);
  }

  function onDragEnter(event) {
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave(event) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  const isLarge = variant === 'empty';

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ALL}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        className={`group w-full rounded-[20px] border border-dashed text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15 ${
          isLarge ? 'p-6 sm:p-8' : 'p-3.5'
        } ${
          dragging
            ? 'border-brand-400 bg-brand-50/80 dark:border-brand-400/50 dark:bg-brand-400/10'
            : 'border-line-strong bg-subtle/40 hover:border-brand-300 hover:bg-brand-50/35 dark:hover:border-brand-400/30 dark:hover:bg-brand-400/[0.06]'
        } disabled:cursor-wait`}
      >
        <span className={`flex ${isLarge ? 'flex-col items-center text-center' : 'items-center gap-3'}`}>
          <span
            className={`flex shrink-0 items-center justify-center rounded-2xl bg-surface text-brand-500 shadow-sm ring-1 ring-line/60 dark:text-brand-300 ${
              isLarge ? 'h-12 w-12' : 'h-9 w-9'
            }`}
          >
            {busy ? (
              <LoaderCircle size={isLarge ? 21 : 17} className="animate-spin" />
            ) : (
              <UploadCloud size={isLarge ? 22 : 17} />
            )}
          </span>
          <span className={isLarge ? 'mt-3 block' : 'min-w-0 flex-1'}>
            <span className="block text-[12.5px] font-bold tracking-[-0.01em] text-ink">
              {busy && currentFile
                ? `Adding ${currentFile.name}`
                : isLarge
                  ? 'Drop files here from this laptop'
                  : 'Drop files here to add from this laptop'}
            </span>
            <span className="mt-1 block text-[10.5px] font-medium leading-4 text-ink-muted">
              {busy
                ? progress?.phase === 'finalizing'
                  ? 'Finishing up…'
                  : progress?.retrying
                    ? `Reconnecting · retry ${progress.retryAttempt || 1}`
                    : progress?.speedBytesPerSecond
                      ? `${formatSpeed(progress.speedBytesPerSecond)} · ${progress.percent || 0}%`
                      : 'Preparing upload…'
                : isLarge
                  ? 'or click to browse · your files stay temporary'
                  : 'Click to browse'}
            </span>
          </span>
          {!busy && !isLarge && (
            <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              Browse
            </span>
          )}
        </span>
        {busy && progress && (
          <span className="mt-3 block">
            <ProgressBar value={progress.percent || 0} />
            <span className="mt-1.5 flex justify-between text-[9px] font-semibold text-ink-muted">
              <span>{formatBytes(progress.uploadedBytes || 0)}</span>
              <span>{formatBytes(currentFile?.size || 0)}</span>
            </span>
          </span>
        )}
      </button>

      {error && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-rose-200/70 bg-rose-50 px-3 py-2 text-[10.5px] font-medium leading-4 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!busy && progress?.phase === 'complete' && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
          <Check size={12} strokeWidth={3} />
          Upload complete
        </div>
      )}
    </div>
  );
}
