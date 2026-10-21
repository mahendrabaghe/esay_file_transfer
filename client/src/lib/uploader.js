import { api, ApiError, sendChunk } from './api.js';
import { fingerprintFile, sha256Blob } from './crypto.js';

const MAX_ATTEMPTS = 4;

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload cancelled', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('Upload cancelled', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isRetryable(error) {
  if (error?.name === 'AbortError') return false;
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status === 429 || error.status >= 500;
}

function retryDelay(error, attempt) {
  const retryAfter = Number(error?.details?.retryAfter);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 10000);
  return Math.min(700 * 2 ** attempt + Math.random() * 250, 8000);
}

async function withRetry(action, { signal, onRetry } = {}) {
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
    try {
      return await action(attempt);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS - 1) throw error;
      onRetry?.(attempt + 1, error);
      await wait(retryDelay(error, attempt), signal);
    }
  }
  throw lastError;
}

function expectedChunkSize(upload, index) {
  if (index < upload.totalChunks - 1) return upload.chunkSize;
  return upload.size - upload.chunkSize * (upload.totalChunks - 1);
}

export async function uploadFile({ file, token, signal, onProgress }) {
  const fingerprint = await fingerprintFile(file);
  onProgress?.({
    phase: 'preparing',
    percent: 0,
    uploadedBytes: 0,
    speedBytesPerSecond: 0,
    retrying: false,
  });

  const init = await withRetry(
    () => api.createUpload(token, file, fingerprint, { signal }),
    {
      signal,
      onRetry: (attempt) =>
        onProgress?.({
          phase: 'preparing',
          percent: 0,
          uploadedBytes: 0,
          speedBytesPerSecond: 0,
          retrying: true,
          retryAttempt: attempt,
        }),
    },
  );

  if (init.duplicate) {
    onProgress?.({
      phase: 'complete',
      percent: 100,
      uploadedBytes: file.size,
      speedBytesPerSecond: 0,
      retrying: false,
      duplicate: true,
    });
    return { duplicate: true, file: init.file };
  }

  const upload = init.upload;
  const received = new Set(upload.receivedChunks || []);
  const initialBytes = [...received].reduce(
    (sum, index) => sum + expectedChunkSize(upload, index),
    0,
  );
  let uploadedBytes = initialBytes;
  let startedAt = performance.now();
  let speedBytesPerSecond = 0;

  const report = (extra = {}) => {
    const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.05);
    const movedThisRun = Math.max(0, uploadedBytes - initialBytes);
    if (movedThisRun > 0) speedBytesPerSecond = movedThisRun / elapsedSeconds;
    onProgress?.({
      phase: 'uploading',
      percent: Math.min(99, Math.round((uploadedBytes / file.size) * 100)),
      uploadedBytes,
      speedBytesPerSecond,
      retrying: false,
      ...extra,
    });
  };

  report();

  for (let index = 0; index < upload.totalChunks; index += 1) {
    if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
    if (received.has(index)) continue;

    const start = index * upload.chunkSize;
    const end = Math.min(file.size, start + upload.chunkSize);
    const chunk = file.slice(start, end);
    const checksum = await sha256Blob(chunk);

    const sent = await withRetry(
      () =>
        sendChunk({
          token,
          uploadId: upload.id,
          index,
          chunk,
          checksum,
          signal,
          onUploadProgress: (loaded) => {
            const progressBytes = Math.min(file.size, start + loaded);
            if (progressBytes > uploadedBytes) uploadedBytes = progressBytes;
            report();
          },
        }),
      {
        signal,
        onRetry: (attempt) => {
          uploadedBytes = Math.max(initialBytes, start);
          report({ retrying: true, retryAttempt: attempt });
        },
      },
    );

    received.add(index);
    uploadedBytes = Math.max(uploadedBytes, sent?.receivedBytes ?? end);
    report();
  }

  onProgress?.({
    phase: 'finalizing',
    percent: 99,
    uploadedBytes: file.size,
    speedBytesPerSecond,
    retrying: false,
  });

  const completed = await withRetry(() => api.completeUpload(token, upload.id, { signal }), {
    signal,
    onRetry: (attempt) =>
      onProgress?.({
        phase: 'finalizing',
        percent: 99,
        uploadedBytes: file.size,
        speedBytesPerSecond,
        retrying: true,
        retryAttempt: attempt,
      }),
  });

  onProgress?.({
    phase: 'complete',
    percent: 100,
    uploadedBytes: file.size,
    speedBytesPerSecond,
    retrying: false,
    duplicate: Boolean(completed.duplicate),
  });

  return {
    duplicate: Boolean(completed.duplicate),
    file: completed.file,
  };
}
