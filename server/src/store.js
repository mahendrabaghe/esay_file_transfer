import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createSessionId,
  createToken,
  formatSessionCode,
  hashToken,
} from './security.js';

export class QuickDropStore extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.tokensByHash = new Map();
    this.filesById = new Map();
    this.sessions = new Set();
    this.sweepTimer = null;
    this.sessionsRoot = path.join(config.storageDir, 'sessions');
    this.tempRoot = path.join(config.storageDir, 'temp');
  }

  async initialize() {
    await fs.mkdir(this.config.storageDir, { recursive: true });
    await fs.rm(this.sessionsRoot, { recursive: true, force: true });
    await fs.rm(this.tempRoot, { recursive: true, force: true });
    await fs.mkdir(this.sessionsRoot, { recursive: true });
    await fs.mkdir(this.tempRoot, { recursive: true });

    this.sweepTimer = setInterval(() => {
      this.sweep().catch((error) => {
        console.error('[quickdrop] cleanup sweep failed:', error.message);
      });
    }, this.config.cleanupIntervalMs);
    this.sweepTimer.unref?.();
  }

  async createSession() {
    let id;
    do {
      id = createSessionId(8);
    } while ([...this.sessions].some((session) => session.id === id));

    const now = Date.now();
    const senderToken = createToken(32);
    const receiverToken = createToken(32);
    const senderTokenHash = hashToken(senderToken);
    const receiverTokenHash = hashToken(receiverToken);

    const session = {
      id,
      code: formatSessionCode(id),
      sharePath: `/s/${senderToken}`,
      createdAt: now,
      lastActivityAt: now,
      lastUpdateSentAt: 0,
      expiresAt: now + this.config.sessionTtlMs,
      tokenHashes: [senderTokenHash, receiverTokenHash],
      senderSockets: new Set(),
      receiverSockets: new Set(),
      files: new Map(),
      fingerprints: new Set(),
      messages: [],
      uploads: new Map(),
      uploadsByFingerprint: new Map(),
      completedUploads: new Map(),
      totalBytes: 0,
      reservedBytes: 0,
      ended: false,
      lastActivityReason: 'created',
    };

    await fs.mkdir(this.uploadDirectory(session), { recursive: true });

    this.sessions.add(session);
    this.tokensByHash.set(senderTokenHash, { session, role: 'sender' });
    this.tokensByHash.set(receiverTokenHash, { session, role: 'receiver' });

    return { session, senderToken, receiverToken };
  }

  resolveToken(rawToken) {
    if (typeof rawToken !== 'string' || rawToken.length < 24 || rawToken.length > 128) {
      return null;
    }
    const entry = this.tokensByHash.get(hashToken(rawToken));
    if (!entry) return null;

    const { session, role } = entry;
    return {
      session,
      role,
      expired: session.ended || session.expiresAt <= Date.now(),
      active: !session.ended && session.expiresAt > Date.now(),
    };
  }

  isActive(session) {
    return Boolean(session && !session.ended && session.expiresAt > Date.now());
  }

  touch(session, { force = false, reason = 'activity' } = {}) {
    if (!this.isActive(session)) return false;
    const now = Date.now();
    session.lastActivityAt = now;
    session.expiresAt = now + this.config.sessionTtlMs;
    session.lastActivityReason = reason;

    if (force || now - session.lastUpdateSentAt >= 5000) {
      session.lastUpdateSentAt = now;
      this.emit('activity', { session });
    }
    return true;
  }

  addSocket(session, role, socketId) {
    if (role === 'receiver') session.receiverSockets.add(socketId);
    else session.senderSockets.add(socketId);
  }

  removeSocket(session, role, socketId) {
    if (role === 'receiver') session.receiverSockets.delete(socketId);
    else session.senderSockets.delete(socketId);
  }

  getPresence(session) {
    const now = Date.now();
    const liveUploads = [...session.uploads.values()].filter(
      (upload) => upload.bytesReceived > 0 && now - upload.updatedAt < 2 * 60 * 1000,
    );
    return {
      senders: session.senderSockets.size,
      receivers: session.receiverSockets.size,
      receiving: liveUploads.length > 0,
      connected: session.senderSockets.size > 0,
    };
  }

  addUpload(session, upload) {
    session.uploads.set(upload.id, upload);
    session.uploadsByFingerprint.set(upload.fingerprint, upload.id);
    session.reservedBytes += upload.size;
  }

  removeUpload(session, upload) {
    if (!session.uploads.has(upload.id)) return;
    session.uploads.delete(upload.id);
    if (session.uploadsByFingerprint.get(upload.fingerprint) === upload.id) {
      session.uploadsByFingerprint.delete(upload.fingerprint);
    }
    session.reservedBytes = Math.max(0, session.reservedBytes - upload.size);
  }

  discardUpload(session, upload) {
    this.removeUpload(session, upload);
    fs.rm(this.uploadChunkDirectory(session, upload), { recursive: true, force: true }).catch(() => {});
    this.emit('presenceChanged', { session });
  }

  registerFile(session, file) {
    session.files.set(file.id, file);
    this.filesById.set(file.id, { session, file });
    session.fingerprints.add(file.fingerprint);
    session.totalBytes += file.size;
  }

  addMessage(session, message) {
    session.messages.push(message);
    return message;
  }

  findFile(fileId) {
    const entry = this.filesById.get(fileId);
    if (!entry) return null;
    const { session, file } = entry;
    if (!this.isActive(session) || file.expiresAt <= Date.now()) return null;
    return entry;
  }

  sessionDirectory(session) {
    return path.join(this.sessionsRoot, session.id);
  }

  uploadDirectory(session) {
    return path.join(this.sessionDirectory(session), 'uploads');
  }

  fileDirectory(session) {
    return path.join(this.sessionDirectory(session), 'files');
  }

  uploadChunkDirectory(session, upload) {
    return path.join(this.uploadDirectory(session), upload.id);
  }

  async endSession(session, reason = 'stopped') {
    if (!session || session.ended) return false;
    session.ended = true;

    for (const tokenHash of session.tokenHashes) this.tokensByHash.delete(tokenHash);
    for (const fileId of session.files.keys()) this.filesById.delete(fileId);
    session.files.clear();
    session.uploads.clear();
    session.uploadsByFingerprint.clear();
    session.senderSockets.clear();
    session.receiverSockets.clear();
    this.sessions.delete(session);

    this.emit('sessionEnded', { session, reason });

    fs.rm(this.sessionDirectory(session), {
      recursive: true,
      force: true,
      maxRetries: 2,
      retryDelay: 100,
    }).catch((error) => {
      console.warn('[quickdrop] could not remove expired session files:', error.message);
    });

    return true;
  }

  async sweep(now = Date.now()) {
    for (const session of [...this.sessions]) {
      if (session.expiresAt <= now || session.ended) {
        await this.endSession(session, 'expired');
        continue;
      }

      await this.expireStaleUploads(session, now);
      await this.expireOldFiles(session, now);
    }
  }

  async expireStaleUploads(session, now) {
    for (const upload of [...session.uploads.values()]) {
      if (now - upload.updatedAt > this.config.uploadTtlMs) {
        this.removeUpload(session, upload);
        await fs
          .rm(this.uploadChunkDirectory(session, upload), { recursive: true, force: true })
          .catch(() => {});
      }
    }
  }

  async expireOldFiles(session, now) {
    for (const file of [...session.files.values()]) {
      if (file.expiresAt > now) continue;
      session.files.delete(file.id);
      this.filesById.delete(file.id);
      session.totalBytes = Math.max(0, session.totalBytes - file.size);
      this.emit('fileExpired', { session, file });
      await fs.unlink(file.storagePath).catch(() => {});
    }
  }

  async shutdown() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
    for (const session of [...this.sessions]) {
      session.ended = true;
    }
    this.sessions.clear();
    this.tokensByHash.clear();
    this.filesById.clear();
    await fs.rm(this.sessionsRoot, { recursive: true, force: true }).catch(() => {});
    await fs.rm(this.tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}
