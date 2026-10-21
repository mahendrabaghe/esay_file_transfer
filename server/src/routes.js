import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, raw } from 'express';
import rateLimit from 'express-rate-limit';
import archiver from 'archiver';
import contentDisposition from 'content-disposition';
import { ApiError, asyncRoute } from './errors.js';
import { getLanAddresses, isLoopbackAddress } from './network.js';
import {
  createToken,
  fingerprintIsValid,
  hashToken,
  inspectFile,
  safeTokenEqual,
  uniqueFileName,
  validateMessage,
} from './security.js';
import {
  serializeFile,
  serializeMessage,
  serializeReceiverState,
  serializeSession,
} from './serializers.js';

function limiter(config, { windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !config.rateLimits.enabled,
    handler: (req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message },
      });
    },
  });
}

function authenticate(store, requiredRole = null) {
  return (req, res, next) => {
    const resolved = store.resolveToken(req.params.token);
    if (!resolved) {
      return next(new ApiError(404, 'SESSION_NOT_FOUND', 'This sharing session does not exist.'));
    }
    if (!resolved.active) {
      return next(new ApiError(410, 'SESSION_EXPIRED', 'This sharing session has ended.'));
    }
    if (requiredRole && resolved.role !== requiredRole) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have access to do that.'));
    }
    req.session = resolved.session;
    req.role = resolved.role;
    next();
  };
}

function assertActive(store, session) {
  if (!store.isActive(session)) {
    throw new ApiError(410, 'SESSION_EXPIRED', 'This sharing session has ended.');
  }
}

function expectedChunkSize(upload, index) {
  if (index < upload.totalChunks - 1) return upload.chunkSize;
  return upload.size - upload.chunkSize * (upload.totalChunks - 1);
}

function chunkPath(store, session, upload, index) {
  return path.join(
    store.uploadChunkDirectory(session, upload),
    `${String(index).padStart(6, '0')}.chunk`,
  );
}

function fileSummary(file) {
  return {
    id: file.id,
    name: file.name,
    size: file.size,
    kind: file.kind,
    createdAt: file.createdAt,
  };
}

function uploadPayload(upload) {
  return {
    id: upload.id,
    name: upload.name,
    size: upload.size,
    chunkSize: upload.chunkSize,
    totalChunks: upload.totalChunks,
    receivedChunks: [...upload.receivedChunks.keys()].sort((a, b) => a - b),
    kind: upload.kind,
  };
}

async function appendChunkToFile(sourcePath, writeStream) {
  await new Promise((resolve, reject) => {
    const readStream = createReadStream(sourcePath);
    const onWriteError = (error) => reject(error);
    writeStream.once('error', onWriteError);
    readStream.once('error', (error) => {
      writeStream.off('error', onWriteError);
      reject(error);
    });
    readStream.once('end', () => {
      writeStream.off('error', onWriteError);
      resolve();
    });
    readStream.pipe(writeStream, { end: false });
  });
}

export function createApiRouter({ store, realtime, config }) {
  const router = Router();

  const createSessionLimiter = limiter(config, {
    windowMs: 60 * 60 * 1000,
    limit: config.rateLimits.createSession,
    message: 'Too many sharing sessions started. Please wait a little and try again.',
  });
  const uploadLimiter = limiter(config, {
    windowMs: 60 * 1000,
    limit: config.rateLimits.uploadRequests,
    message: 'Too many upload requests. Please wait a moment and retry.',
  });
  const messageLimiter = limiter(config, {
    windowMs: 60 * 1000,
    limit: 120,
    message: 'Too many messages. Please wait a moment and retry.',
  });

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  router.get('/network', (req, res) => {
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Not found.' },
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ addresses: getLanAddresses() });
  });

  router.post(
    '/sessions',
    createSessionLimiter,
    asyncRoute(async (req, res) => {
      const { session, senderToken, receiverToken } = await store.createSession();
      res.status(201).json({
        senderToken,
        receiverToken,
        session: serializeSession(session, config, store.getPresence(session)),
      });
    }),
  );

  router.get(
    '/sessions/:token',
    authenticate(store),
    asyncRoute(async (req, res) => {
      assertActive(store, req.session);
      const presence = store.getPresence(req.session);
      if (req.role === 'receiver') {
        res.json({
          role: req.role,
          serverTime: Date.now(),
          ...serializeReceiverState(req.session, config, presence),
        });
      } else {
        res.json({
          role: req.role,
          serverTime: Date.now(),
          session: serializeSession(req.session, config, presence),
        });
      }
    }),
  );

  router.delete(
    '/sessions/:token',
    authenticate(store, 'receiver'),
    asyncRoute(async (req, res) => {
      assertActive(store, req.session);
      await store.endSession(req.session, 'stopped');
      res.status(204).end();
    }),
  );

  router.post(
    '/sessions/:token/messages',
    messageLimiter,
    authenticate(store, 'sender'),
    asyncRoute(async (req, res) => {
      const session = req.session;
      assertActive(store, session);
      if (session.messages.length >= config.maxMessagesPerSession) {
        throw new ApiError(409, 'MESSAGE_LIMIT_REACHED', 'This session has reached its message limit.');
      }

      const validated = validateMessage(req.body?.type, req.body?.content, config.maxTextLength);
      const message = {
        id: createToken(10),
        type: validated.type,
        content: validated.content,
        href: validated.href || null,
        createdAt: Date.now(),
      };

      store.addMessage(session, message);
      store.touch(session, { reason: 'message' });
      realtime.emitMessage(session, message);

      res.status(201).json({ message: serializeMessage(message) });
    }),
  );

  router.post(
    '/sessions/:token/uploads',
    uploadLimiter,
    authenticate(store),
    asyncRoute(async (req, res) => {
      const session = req.session;
      assertActive(store, session);

      const { name, size, fingerprint: suppliedFingerprint } = req.body || {};
      const inspected = inspectFile(name, size);

      if (size > config.maxFileSizeBytes) {
        throw new ApiError(
          413,
          'FILE_TOO_LARGE',
          `Files must be ${Math.round(config.maxFileSizeBytes / (1024 * 1024))} MB or smaller.`,
        );
      }

      const fingerprint = fingerprintIsValid(suppliedFingerprint)
        ? suppliedFingerprint.toLowerCase()
        : hashToken(createToken(24));

      const completedFile = [...session.files.values()].find(
        (file) => file.fingerprint === fingerprint && file.expiresAt > Date.now(),
      );
      if (completedFile) {
        store.touch(session, { reason: 'duplicate-upload' });
        return res.status(200).json({
          duplicate: true,
          file: fileSummary(completedFile),
        });
      }

      const pendingUploadId = session.uploadsByFingerprint.get(fingerprint);
      if (pendingUploadId) {
        const pending = session.uploads.get(pendingUploadId);
        if (pending && pending.name === inspected.name && pending.size === size) {
          store.touch(session, { reason: 'resume-upload' });
          return res.status(200).json({
            duplicate: false,
            resumed: true,
            upload: uploadPayload(pending),
          });
        }
      }

      if (session.totalBytes + session.reservedBytes + size > config.maxSessionBytes) {
        throw new ApiError(
          413,
          'SESSION_QUOTA_EXCEEDED',
          'This sharing session does not have enough space left.',
        );
      }
      if (session.files.size + session.uploads.size >= config.maxFilesPerSession) {
        throw new ApiError(
          409,
          'FILE_COUNT_LIMIT',
          `A session can hold up to ${config.maxFilesPerSession} files.`,
        );
      }

      const upload = {
        id: createToken(18),
        fingerprint,
        name: inspected.name,
        size,
        extension: inspected.extension,
        kind: inspected.kind,
        mimeType: inspected.mimeType,
        chunkSize: config.chunkSizeBytes,
        totalChunks: Math.ceil(size / config.chunkSizeBytes),
        receivedChunks: new Map(),
        bytesReceived: 0,
        source: req.role === 'receiver' ? 'laptop' : 'phone',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await fs.mkdir(store.uploadChunkDirectory(session, upload), { recursive: true });
      store.addUpload(session, upload);
      store.touch(session, { reason: 'upload-started' });

      res.status(201).json({
        duplicate: false,
        upload: uploadPayload(upload),
      });
    }),
  );

  router.put(
    '/sessions/:token/uploads/:uploadId/chunks/:index',
    uploadLimiter,
    authenticate(store),
    raw({ type: () => true, limit: config.chunkSizeBytes + 64 * 1024 }),
    asyncRoute(async (req, res) => {
      const session = req.session;
      assertActive(store, session);

      const upload = session.uploads.get(req.params.uploadId);
      if (!upload) {
        throw new ApiError(404, 'UPLOAD_NOT_FOUND', 'This upload has expired or was already completed.');
      }

      const index = Number(req.params.index);
      if (!Number.isInteger(index) || index < 0 || index >= upload.totalChunks) {
        throw new ApiError(400, 'INVALID_CHUNK', 'That upload chunk is out of range.');
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw new ApiError(400, 'EMPTY_CHUNK', 'The upload chunk was empty.');
      }

      const expectedSize = expectedChunkSize(upload, index);
      if (req.body.length !== expectedSize) {
        throw new ApiError(400, 'INVALID_CHUNK_SIZE', 'The upload chunk size did not match.');
      }

      const declaredHash = String(req.get('x-chunk-sha256') || '').toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(declaredHash)) {
        throw new ApiError(400, 'CHUNK_HASH_REQUIRED', 'A valid chunk checksum is required.');
      }
      const actualHash = createHash('sha256').update(req.body).digest('hex');
      if (!safeTokenEqual(declaredHash, actualHash)) {
        throw new ApiError(400, 'CHUNK_CHECKSUM_MISMATCH', 'The upload chunk was corrupted. Retrying.');
      }

      const finalChunkPath = chunkPath(store, session, upload, index);
      await fs.mkdir(path.dirname(finalChunkPath), { recursive: true });

      let alreadyReceived = upload.receivedChunks.has(index);
      if (!alreadyReceived && (await fs.stat(finalChunkPath).catch(() => null))) {
        const existing = await fs.readFile(finalChunkPath);
        const existingHash = createHash('sha256').update(existing).digest('hex');
        if (existing.length === expectedSize && safeTokenEqual(existingHash, actualHash)) {
          alreadyReceived = true;
        }
      }

      if (!alreadyReceived) {
        const tempPath = `${finalChunkPath}.${randomBytes(6).toString('hex')}.part`;
        await fs.writeFile(tempPath, req.body, { flag: 'wx' });
        await fs.rename(tempPath, finalChunkPath);
        upload.receivedChunks.set(index, req.body.length);
        upload.bytesReceived = [...upload.receivedChunks.values()].reduce(
          (sum, chunkBytes) => sum + chunkBytes,
          0,
        );
        upload.updatedAt = Date.now();
        store.touch(session, { reason: 'upload-chunk' });
      }

      const wasStarted = upload.receivedChunks.size <= 1 && !alreadyReceived;
      if (wasStarted) {
        realtime.emitTransferStart(session, upload);
      }
      realtime.emitTransferProgress(session, upload);
      realtime.broadcastPresence(session);

      res.json({
        uploadId: upload.id,
        received: index,
        receivedChunks: upload.receivedChunks.size,
        receivedBytes: upload.bytesReceived,
        alreadyReceived,
      });
    }),
  );

  router.post(
    '/sessions/:token/uploads/:uploadId/complete',
    uploadLimiter,
    authenticate(store),
    asyncRoute(async (req, res) => {
      const session = req.session;
      assertActive(store, session);

      const completed = session.completedUploads.get(req.params.uploadId);
      if (completed) {
        return res.status(200).json({ duplicate: true, file: completed });
      }

      const upload = session.uploads.get(req.params.uploadId);
      if (!upload) {
        throw new ApiError(404, 'UPLOAD_NOT_FOUND', 'This upload has expired or was already completed.');
      }

      if (
        upload.receivedChunks.size !== upload.totalChunks ||
        upload.bytesReceived !== upload.size
      ) {
        throw new ApiError(
          409,
          'UPLOAD_INCOMPLETE',
          'Some file chunks are still missing. Retry the upload.',
          { receivedChunks: upload.receivedChunks.size, totalChunks: upload.totalChunks },
        );
      }

      const uploadDir = store.uploadChunkDirectory(session, upload);
      const filesDir = store.fileDirectory(session);
      await fs.mkdir(filesDir, { recursive: true });

      const fileId = createToken(18);
      const accessToken = createToken(24);
      const outputPath = path.join(filesDir, fileId);
      const assembledPath = path.join(uploadDir, `assembled-${randomBytes(6).toString('hex')}`);

      const writeStream = createWriteStream(assembledPath, { flags: 'wx' });
      try {
        for (let index = 0; index < upload.totalChunks; index += 1) {
          await appendChunkToFile(chunkPath(store, session, upload, index), writeStream);
        }
        await new Promise((resolve, reject) => {
          writeStream.once('error', reject);
          writeStream.end(resolve);
        });

        const stats = await fs.stat(assembledPath);
        if (stats.size !== upload.size) {
          throw new ApiError(409, 'UPLOAD_SIZE_MISMATCH', 'The assembled file was incomplete.');
        }
        assertActive(store, session);
        await fs.rename(assembledPath, outputPath);
      } catch (error) {
        writeStream.destroy();
        await fs.rm(assembledPath, { force: true }).catch(() => {});
        throw error;
      }

      const existingNames = [...session.files.values()].map((file) => file.name);
      const now = Date.now();
      const file = {
        id: fileId,
        sessionId: session.id,
        name: uniqueFileName(upload.name, existingNames),
        size: upload.size,
        mimeType: upload.mimeType,
        kind: upload.kind,
        extension: upload.extension,
        source: upload.source,
        accessToken,
        storagePath: outputPath,
        fingerprint: upload.fingerprint,
        createdAt: now,
        expiresAt: now + config.fileRetentionMs,
      };

      store.removeUpload(session, upload);
      store.registerFile(session, file);
      store.touch(session, { reason: 'upload-complete' });
      session.completedUploads.set(upload.id, fileSummary(file));

      fs.rm(uploadDir, { recursive: true, force: true }).catch(() => {});
      realtime.emitTransferEnd(session, upload);
      realtime.emitFile(session, file);
      realtime.broadcastPresence(session);

      res.status(201).json({
        duplicate: false,
        file: req.role === 'receiver' ? serializeFile(file) : fileSummary(file),
      });
    }),
  );

  router.delete(
    '/sessions/:token/uploads/:uploadId',
    authenticate(store),
    asyncRoute(async (req, res) => {
      const upload = req.session.uploads.get(req.params.uploadId);
      if (upload) store.discardUpload(req.session, upload);
      res.status(204).end();
    }),
  );

  const serveStoredFile = (inline) => (req, res, next) => {
    const entry = store.findFile(req.params.fileId);
    if (!entry) {
      return next(new ApiError(404, 'FILE_NOT_FOUND', 'This file is no longer available.'));
    }
    if (!safeTokenEqual(req.query.token || '', entry.file.accessToken)) {
      return next(new ApiError(404, 'FILE_NOT_FOUND', 'This file is no longer available.'));
    }
    if (inline && entry.file.kind !== 'image') {
      return next(new ApiError(404, 'FILE_NOT_FOUND', 'This file is no longer available.'));
    }

    store.touch(entry.session, { reason: 'download' });

    res.setHeader('Content-Type', entry.file.mimeType);
    res.setHeader(
      'Content-Disposition',
      contentDisposition(entry.file.name, { type: inline ? 'inline' : 'attachment' }),
    );
    res.setHeader('Content-Length', entry.file.size);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");

    const stream = createReadStream(entry.file.storagePath);
    stream.on('error', (error) => {
      if (!res.headersSent) next(new ApiError(404, 'FILE_NOT_FOUND', 'This file is no longer available.'));
      else res.destroy(error);
    });
    stream.pipe(res);
  };

  router.get('/files/:fileId/download', serveStoredFile(false));
  router.get('/files/:fileId/preview', serveStoredFile(true));

  router.get(
    '/sessions/:token/archive',
    authenticate(store, 'receiver'),
    asyncRoute(async (req, res) => {
      const session = req.session;
      assertActive(store, session);
      const files = [...session.files.values()].filter((file) => file.expiresAt > Date.now());
      if (files.length === 0) {
        throw new ApiError(404, 'NO_FILES', 'There are no files to download yet.');
      }

      store.touch(session, { reason: 'archive-download' });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        contentDisposition(`QuickDrop-${session.code}.zip`, { type: 'attachment' }),
      );
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('warning', (error) => {
        if (error.code !== 'ENOENT') console.warn('[quickdrop] zip warning:', error.message);
      });
      archive.on('error', (error) => {
        if (!res.headersSent) res.status(500).json({ error: { code: 'ARCHIVE_FAILED', message: 'Could not build the ZIP.' } });
        else res.destroy(error);
      });
      archive.pipe(res);
      for (const file of files) {
        archive.append(createReadStream(file.storagePath), { name: file.name });
      }
      await archive.finalize();
    }),
  );

  router.use((req, res, next) => {
    next(new ApiError(404, 'NOT_FOUND', 'API route not found.'));
  });

  return router;
}
