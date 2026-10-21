const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const configuredPublicUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');

export const API_BASE = configuredApiUrl;
export const PUBLIC_APP_URL = configuredPublicUrl || window.location.origin;
export const SOCKET_URL = API_BASE || window.location.origin;
export const IS_LOCALHOST = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function apiUrl(route) {
  if (!route) return API_BASE;
  return `${API_BASE}${route.startsWith('/') ? route : `/${route}`}`;
}

export function shareUrl(sharePath, origin = PUBLIC_APP_URL) {
  if (!sharePath) return '';
  return `${origin}${sharePath.startsWith('/') ? sharePath : `/${sharePath}`}`;
}

export async function resolveShareOrigin() {
  if (configuredPublicUrl) return configuredPublicUrl;
  if (!IS_LOCALHOST) return window.location.origin;

  try {
    const response = await fetch('/api/network', { headers: { Accept: 'application/json' } });
    if (!response.ok) return window.location.origin;

    const payload = await response.json();
    const address = payload?.addresses?.find((entry) => entry?.address)?.address;
    if (!address) return window.location.origin;

    const url = new URL(window.location.origin);
    url.hostname = address;
    return url.origin;
  } catch {
    return window.location.origin;
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function request(route, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type') && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(apiUrl(route), { ...options, headers });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach QuickDrop. Check your connection.');
  }

  if (response.status === 204) return null;
  const payload = await readJson(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code || 'REQUEST_FAILED',
      payload?.error?.message || 'Something went wrong. Please try again.',
      payload?.error?.details || null,
    );
  }

  return payload;
}

export const api = {
  createSession: () =>
    request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getSession: (token) => request(`/api/sessions/${encodeURIComponent(token)}`),
  stopSession: (token) =>
    request(`/api/sessions/${encodeURIComponent(token)}`, { method: 'DELETE' }),
  sendMessage: (token, type, content) =>
    request(`/api/sessions/${encodeURIComponent(token)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ type, content }),
    }),
  createUpload: (token, file, fingerprint, options = {}) =>
    request(`/api/sessions/${encodeURIComponent(token)}/uploads`, {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        fingerprint,
      }),
      signal: options.signal,
    }),
  completeUpload: (token, uploadId, options = {}) =>
    request(
      `/api/sessions/${encodeURIComponent(token)}/uploads/${encodeURIComponent(uploadId)}/complete`,
      { method: 'POST', body: JSON.stringify({}), signal: options.signal },
    ),
  cancelUpload: (token, uploadId) =>
    request(
      `/api/sessions/${encodeURIComponent(token)}/uploads/${encodeURIComponent(uploadId)}`,
      { method: 'DELETE' },
    ),
  archiveUrl: (token) =>
    apiUrl(`/api/sessions/${encodeURIComponent(token)}/archive`),
};

export function sendChunk({ token, uploadId, index, chunk, checksum, signal, onUploadProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'PUT',
      apiUrl(
        `/api/sessions/${encodeURIComponent(token)}/uploads/${encodeURIComponent(uploadId)}/chunks/${index}`,
      ),
    );
    xhr.timeout = 300000;
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-Chunk-SHA256', checksum);
    xhr.setRequestHeader('Accept', 'application/json');

    const onAbort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) {
        reject(new DOMException('Upload cancelled', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onUploadProgress?.(event.loaded, event.total);
    };

    xhr.onload = () => {
      cleanup();
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }
      reject(
        new ApiError(
          xhr.status,
          payload?.error?.code || 'CHUNK_FAILED',
          payload?.error?.message || 'That part of the upload did not arrive. Retrying.',
          { retryAfter: xhr.getResponseHeader('Retry-After') },
        ),
      );
    };

    xhr.onerror = () => {
      cleanup();
      reject(new ApiError(0, 'NETWORK_ERROR', 'The connection dropped while uploading.'));
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(new ApiError(0, 'UPLOAD_TIMEOUT', 'That upload part took too long. Retrying.'));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };

    xhr.send(chunk);
  });
}
