import { createServer as createHttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { loadConfig } from './config.js';
import { ApiError } from './errors.js';
import { attachRealtime } from './realtime.js';
import { createApiRouter } from './routes.js';
import { QuickDropStore } from './store.js';

function corsOptions(config) {
  return {
    origin(origin, callback) {
      if (!origin || config.clientOrigins.length === 0) return callback(null, true);
      return callback(null, config.clientOrigins.includes(origin));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Chunk-SHA256'],
    exposedHeaders: ['Content-Disposition', 'Content-Length'],
    maxAge: 86400,
  };
}

export async function createQuickDropServer(config = loadConfig()) {
  const store = new QuickDropStore(config);
  await store.initialize();

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  const httpServer = createHttpServer(app);
  const realtime = attachRealtime(httpServer, store, config);
  const allowedCors = corsOptions(config);

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          mediaSrc: ["'self'", 'blob:'],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(cors(allowedCors));
  app.options('*', cors(allowedCors));
  app.use(compression());
  app.use(express.json({ limit: '32kb' }));

  app.use('/api', createApiRouter({ store, realtime, config }));

  const indexHtml = path.join(config.clientDist, 'index.html');
  const serveFrontend = config.serveClient && existsSync(indexHtml);
  if (serveFrontend) {
    app.use(
      express.static(config.clientDist, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(indexHtml);
    });
  } else if (config.serveClient) {
    console.warn(`[quickdrop] Client build not found at ${indexHtml}. Serving API only.`);
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api') || !serveFrontend) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Not found.' },
      });
    }
    return res.status(404).send('Not found');
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    if (error?.type === 'entity.too.large') {
      return res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'The upload request was too large. Try a smaller file or chunk.',
        },
      });
    }

    if (error instanceof ApiError) {
      return res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }

    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'The request was not valid JSON.' },
      });
    }

    console.error('[quickdrop] unhandled request error:', error);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    });
  });

  return {
    app,
    httpServer,
    io: realtime.io,
    realtime,
    store,
    config,
    async listen(port = config.port) {
      await new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, () => {
          httpServer.off('error', reject);
          resolve();
        });
      });
      return httpServer.address();
    },
    async close() {
      await realtime.close();
      if (httpServer.listening) {
        await new Promise((resolve) => httpServer.close(() => resolve()));
      }
      await store.shutdown();
    },
  };
}
