import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { io as createSocket } from 'socket.io-client';
import { createQuickDropServer } from '../src/app.js';
import { loadConfig } from '../src/config.js';

let quickdrop;
let baseUrl;
let config;
let tempRoot;
const sockets = [];

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function api(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

async function createSession() {
  const { response, body } = await api('/api/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 201);
  return body;
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = createSocket(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    const timer = setTimeout(() => reject(new Error('socket connect timeout')), 5000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function onceEvent(socket, event, predicate = () => true, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeout);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

async function initUpload(token, { name, buffer, fingerprint = hash(buffer), size = buffer.length }) {
  return api(`/api/sessions/${token}/uploads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, size, fingerprint }),
  });
}

async function sendChunk(token, uploadId, index, chunk) {
  return api(`/api/sessions/${token}/uploads/${uploadId}/chunks/${index}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/octet-stream',
      'x-chunk-sha256': hash(chunk),
    },
    body: chunk,
  });
}

async function uploadBuffer(token, name, buffer) {
  const init = await initUpload(token, { name, buffer });
  assert.equal(init.response.status, 201, JSON.stringify(init.body));
  const { id, chunkSize, totalChunks } = init.body.upload;
  for (let index = 0; index < totalChunks; index += 1) {
    const chunk = buffer.subarray(index * chunkSize, Math.min(buffer.length, (index + 1) * chunkSize));
    const result = await sendChunk(token, id, index, chunk);
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
  }
  const completed = await api(`/api/sessions/${token}/uploads/${id}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  return { init, completed, uploadId: id };
}

before(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'quickdrop-test-'));
  config = loadConfig({
    nodeEnv: 'test',
    isProduction: false,
    serveClient: false,
    port: 0,
    trustProxy: 0,
    storageDir: tempRoot,
    clientOrigins: [],
    sessionTtlMs: 30 * 60 * 1000,
    fileRetentionMs: 30 * 60 * 1000,
    maxFileSizeBytes: 8 * 1024 * 1024,
    maxSessionBytes: 32 * 1024 * 1024,
    maxFilesPerSession: 10,
    chunkSizeBytes: 1024 * 1024,
    cleanupIntervalMs: 200,
    rateLimits: { enabled: false, createSession: 30, uploadRequests: 1200 },
  });
  quickdrop = await createQuickDropServer(config);
  const address = await quickdrop.listen(0);
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  for (const socket of sockets) socket.disconnect();
  await quickdrop?.close();
  await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
});

test('creates isolated receiver and sender tokens', async () => {
  const created = await createSession();
  assert.match(created.senderToken, /^[A-Za-z0-9_-]{40,}$/);
  assert.match(created.receiverToken, /^[A-Za-z0-9_-]{40,}$/);
  assert.notEqual(created.senderToken, created.receiverToken);
  assert.match(created.session.code, /^QD-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  const receiverView = await api(`/api/sessions/${created.receiverToken}`);
  assert.equal(receiverView.response.status, 200);
  assert.equal(receiverView.body.role, 'receiver');
  assert.deepEqual(receiverView.body.files, []);
  assert.deepEqual(receiverView.body.messages, []);

  const senderView = await api(`/api/sessions/${created.senderToken}`);
  assert.equal(senderView.response.status, 200);
  assert.equal(senderView.body.role, 'sender');
  assert.equal(senderView.body.files, undefined);

  const invalid = await api('/api/sessions/not-a-real-session-token-at-all');
  assert.equal(invalid.response.status, 404);
});

test('reports LAN addresses without forcing HTTPS upgrades', async () => {
  const network = await api('/api/network');
  assert.equal(network.response.status, 200);
  assert.ok(Array.isArray(network.body.addresses));
  for (const entry of network.body.addresses) {
    assert.match(entry.address, /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/);
    assert.equal(typeof entry.interface, 'string');
  }

  const csp = network.response.headers.get('content-security-policy') || '';
  assert.equal(csp.includes('upgrade-insecure-requests'), false);
});

test('sender can send text and links in real time', async () => {
  const created = await createSession();
  const receiverSocket = await connectSocket(created.receiverToken);
  const presencePromise = onceEvent(receiverSocket, 'presence', (presence) => presence.senders === 1);
  const senderSocket = await connectSocket(created.senderToken);
  await presencePromise;

  const messagePromise = onceEvent(receiverSocket, 'message:new');
  const text = await api(`/api/sessions/${created.senderToken}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'text', content: 'Hello from the tiny computer' }),
  });
  assert.equal(text.response.status, 201);
  const delivered = await messagePromise;
  assert.equal(delivered.message.content, 'Hello from the tiny computer');
  assert.equal(delivered.message.type, 'text');

  const linkPromise = onceEvent(receiverSocket, 'message:new', (payload) => payload.message.type === 'link');
  const link = await api(`/api/sessions/${created.senderToken}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'link', content: 'https://example.com/docs?q=1' }),
  });
  assert.equal(link.response.status, 201);
  assert.equal((await linkPromise).message.href, 'https://example.com/docs?q=1');

  const javascriptLink = await api(`/api/sessions/${created.senderToken}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'link', content: 'javascript:alert(1)' }),
  });
  assert.equal(javascriptLink.response.status, 400);

  const forbidden = await api(`/api/sessions/${created.receiverToken}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'text', content: 'not allowed' }),
  });
  assert.equal(forbidden.response.status, 403);

  receiverSocket.disconnect();
  senderSocket.disconnect();
});

test('supports resumable chunk uploads, live events, downloads, and ZIP', async () => {
  const created = await createSession();
  const receiverSocket = await connectSocket(created.receiverToken);

  const original = Buffer.from(
    Array.from({ length: 2 * 1024 * 1024 + 333 }, (_, index) => index % 251),
  );
  const fingerprint = hash(original);
  const init = await initUpload(created.receiverToken, {
    name: 'A strange <file> name.jpg',
    buffer: original,
    fingerprint,
  });
  assert.equal(init.response.status, 201, JSON.stringify(init.body));
  assert.equal(init.body.upload.name, 'A strange _file_ name.jpg');
  const { id, chunkSize, totalChunks } = init.body.upload;
  assert.equal(totalChunks, 3);

  const firstChunk = original.subarray(0, chunkSize);
  const first = await sendChunk(created.senderToken, id, 0, firstChunk);
  assert.equal(first.response.status, 200, JSON.stringify(first.body));

  const resumed = await initUpload(created.senderToken, {
    name: 'A strange <file> name.jpg',
    buffer: original,
    fingerprint,
  });
  assert.equal(resumed.response.status, 200);
  assert.equal(resumed.body.resumed, true);
  assert.deepEqual(resumed.body.upload.receivedChunks, [0]);

  const badChunk = await sendChunk(created.senderToken, id, 1, Buffer.from('corrupt'));
  assert.equal(badChunk.response.status, 400);

  for (let index = 1; index < totalChunks; index += 1) {
    const chunk = original.subarray(
      index * chunkSize,
      Math.min(original.length, (index + 1) * chunkSize),
    );
    const filePromise = index === totalChunks - 1
      ? onceEvent(receiverSocket, 'file:new')
      : null;
    const sent = await sendChunk(created.senderToken, id, index, chunk);
    assert.equal(sent.response.status, 200, JSON.stringify(sent.body));
    if (filePromise) {
      const complete = await api(`/api/sessions/${created.senderToken}/uploads/${id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(complete.response.status, 201, JSON.stringify(complete.body));
      const fileEvent = await filePromise;
      assert.equal(fileEvent.file.size, original.length);
      assert.equal(fileEvent.file.kind, 'image');

      const downloadPath = fileEvent.file.downloadPath;
      const download = await fetch(`${baseUrl}${downloadPath}`);
      assert.equal(download.status, 200);
      assert.equal(download.headers.get('content-type'), 'image/jpeg');
      assert.match(download.headers.get('content-disposition'), /^attachment;/);
      const downloaded = Buffer.from(await download.arrayBuffer());
      assert.deepEqual(downloaded, original);

      const preview = await fetch(`${baseUrl}${fileEvent.file.previewPath}`);
      assert.equal(preview.status, 200);
      assert.match(preview.headers.get('content-disposition'), /^inline;/);

      const wrongToken = await fetch(
        `${baseUrl}/api/files/${fileEvent.file.id}/download?token=wrong`,
      );
      assert.equal(wrongToken.status, 404);

      const archive = await fetch(`${baseUrl}/api/sessions/${created.receiverToken}/archive`);
      assert.equal(archive.status, 200);
      assert.equal(archive.headers.get('content-type'), 'application/zip');
      const zip = Buffer.from(await archive.arrayBuffer());
      assert.equal(zip.subarray(0, 2).toString(), 'PK');
      assert.ok(zip.length > 1000);

      const duplicateComplete = await api(
        `/api/sessions/${created.senderToken}/uploads/${id}/complete`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      );
      assert.equal(duplicateComplete.response.status, 200);
      assert.equal(duplicateComplete.body.duplicate, true);

      const duplicateInit = await initUpload(created.senderToken, {
        name: 'A strange <file> name.jpg',
        buffer: original,
        fingerprint,
      });
      assert.equal(duplicateInit.response.status, 200);
      assert.equal(duplicateInit.body.duplicate, true);
    }
  }

  const receiverView = await api(`/api/sessions/${created.receiverToken}`);
  assert.equal(receiverView.body.files.length, 1);
  assert.equal(receiverView.body.session.usage.bytes, original.length);

  receiverSocket.disconnect();
});

test('rejects unsafe file types and enforces limits', async () => {
  const created = await createSession();

  const exe = await initUpload(created.senderToken, {
    name: 'malware.exe',
    buffer: Buffer.from('no'),
  });
  assert.equal(exe.response.status, 415);

  const html = await initUpload(created.senderToken, {
    name: 'page.svg',
    buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
  });
  assert.equal(html.response.status, 415);

  const tooLarge = await initUpload(created.senderToken, {
    name: 'huge.png',
    buffer: Buffer.alloc(0),
    size: config.maxFileSizeBytes + 1,
    fingerprint: hash(Buffer.from('huge')),
  });
  assert.equal(tooLarge.response.status, 413);

  const nullByteName = await initUpload(created.senderToken, {
    name: 'photo\u0000.png',
    buffer: Buffer.from('content'),
  });
  assert.equal(nullByteName.response.status, 201);
  assert.equal(nullByteName.body.upload.name, 'photo.png');
});

test('stops sessions, invalidates files, and expires inactive sessions', async () => {
  const created = await createSession();
  const { completed } = await uploadBuffer(created.senderToken, 'report.pdf', Buffer.from('%PDF-1.4 test'));
  assert.equal(completed.response.status, 201, JSON.stringify(completed.body));

  const viewBefore = await api(`/api/sessions/${created.receiverToken}`);
  assert.equal(viewBefore.body.files.length, 1);
  const downloadPath = `/api/files/${viewBefore.body.files[0].id}/download?token=${
    new URL(`${baseUrl}${viewBefore.body.files[0].downloadPath}`).searchParams.get('token')
  }`;

  const senderCannotStop = await api(`/api/sessions/${created.senderToken}`, { method: 'DELETE' });
  assert.equal(senderCannotStop.response.status, 403);

  const stopped = await api(`/api/sessions/${created.receiverToken}`, { method: 'DELETE' });
  assert.equal(stopped.response.status, 204);

  const unavailable = await api(`/api/sessions/${created.receiverToken}`);
  assert.equal(unavailable.response.status, 404);
  const fileAfterStop = await fetch(`${baseUrl}${downloadPath}`);
  assert.equal(fileAfterStop.status, 404);

  const expiring = await createSession();
  const socket = await connectSocket(expiring.receiverToken);
  const endedPromise = onceEvent(socket, 'session:ended');
  await quickdrop.store.sweep(Date.now() + config.sessionTtlMs + 1000);
  const ended = await endedPromise;
  assert.equal(ended.reason, 'expired');
  const afterExpiry = await api(`/api/sessions/${expiring.senderToken}`);
  assert.equal(afterExpiry.response.status, 404);
  socket.disconnect();
});

test('rejects websocket connections for expired sessions', async () => {
  const created = await createSession();
  await quickdrop.store.sweep(Date.now() + config.sessionTtlMs + 2000);
  await assert.rejects(() => connectSocket(created.senderToken));
});
