import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDist = path.resolve(serverRoot, '..', 'client', 'dist');
const hasClientBuild = existsSync(path.join(clientDist, 'index.html'));
const MB = 1024 * 1024;

function number(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function list(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function loadConfig(overrides = {}) {
  const env = process.env;
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const storageSetting = env.STORAGE_DIR || 'storage';

  const config = {
    nodeEnv,
    isProduction,
    port: number(env.PORT, 3001, { min: 0, max: 65535 }),
    trustProxy: env.TRUST_PROXY === undefined ? (isProduction ? 1 : 0) : number(env.TRUST_PROXY, 0),
    clientOrigins: list(env.CLIENT_ORIGINS) ||
      (isProduction ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']),
    serveClient: env.SERVE_CLIENT ? env.SERVE_CLIENT === 'true' : isProduction || hasClientBuild,
    clientDist,
    storageDir: path.isAbsolute(storageSetting)
      ? storageSetting
      : path.resolve(serverRoot, storageSetting),

    sessionTtlMs: number(env.SESSION_TTL_MINUTES, 30, { min: 1, max: 24 * 60 }) * 60 * 1000,
    fileRetentionMs: number(env.FILE_RETENTION_MINUTES, 60, { min: 1, max: 7 * 24 * 60 }) * 60 * 1000,
    uploadTtlMs: number(env.UPLOAD_TTL_MINUTES, 60, { min: 1, max: 24 * 60 }) * 60 * 1000,
    maxFileSizeBytes: number(env.MAX_FILE_SIZE_MB, 2048, { min: 1, max: 1024 * 50 }) * MB,
    maxSessionBytes: number(env.MAX_SESSION_SIZE_MB, 5120, { min: 1, max: 1024 * 100 }) * MB,
    maxFilesPerSession: number(env.MAX_FILES_PER_SESSION, 100, { min: 1, max: 1000 }),
    maxMessagesPerSession: number(env.MAX_MESSAGES_PER_SESSION, 200, { min: 1, max: 2000 }),
    maxTextLength: number(env.MAX_TEXT_LENGTH, 10000, { min: 1, max: 100000 }),
    chunkSizeBytes: number(env.CHUNK_SIZE_MB, 4, { min: 1, max: 16 }) * MB,
    cleanupIntervalMs: 15000,
    rateLimits: {
      enabled: env.RATE_LIMIT_DISABLED !== 'true',
      createSession: number(env.RATE_LIMIT_SESSION_PER_HOUR, 30, { min: 1, max: 10000 }),
      uploadRequests: number(env.RATE_LIMIT_UPLOAD_PER_MINUTE, 1200, { min: 10, max: 100000 }),
    },
  };

  return { ...config, ...overrides };
}
