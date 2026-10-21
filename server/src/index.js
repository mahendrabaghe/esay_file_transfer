import 'dotenv/config';
import { createQuickDropServer } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const quickdrop = await createQuickDropServer(config);

try {
  const address = await quickdrop.listen();
  const shownPort = typeof address === 'object' && address ? address.port : config.port;
  console.log(`[quickdrop] API and realtime server listening on port ${shownPort}`);
  if (config.serveClient) {
    console.log(`[quickdrop] Serving web app from ${config.clientDist}`);
  }
} catch (error) {
  console.error('[quickdrop] Failed to start:', error);
  await quickdrop.close();
  process.exit(1);
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[quickdrop] ${signal} received, shutting down...`);
  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();
  try {
    await quickdrop.close();
    console.log('[quickdrop] Shutdown complete.');
    process.exit(0);
  } catch (error) {
    console.error('[quickdrop] Shutdown failed:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
