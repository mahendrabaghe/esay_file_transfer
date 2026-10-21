import { Server } from 'socket.io';
import {
  serializeFile,
  serializeMessage,
  serializeReceiverState,
  serializeSession,
} from './serializers.js';

export function attachRealtime(httpServer, store, config) {
  const corsOrigin = config.clientOrigins.length > 0 ? config.clientOrigins : true;
  const io = new Server(httpServer, {
    serveClient: false,
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 64 * 1024,
  });

  const baseRoom = (session) => `session:${session.id}`;
  const receiverRoom = (session) => `session:${session.id}:receivers`;

  const stateForRole = (session, role) => {
    const presence = store.getPresence(session);
    if (role === 'receiver') {
      return serializeReceiverState(session, config, presence);
    }
    return { session: serializeSession(session, config, presence) };
  };

  const broadcastPresence = (session) => {
    if (!store.isActive(session)) return;
    io.to(baseRoom(session)).emit('presence', store.getPresence(session));
  };

  io.use((socket, next) => {
    const resolved = store.resolveToken(socket.handshake.auth?.token);
    if (!resolved) return next(new Error('SESSION_NOT_FOUND'));
    if (!resolved.active) return next(new Error('SESSION_EXPIRED'));

    socket.data.session = resolved.session;
    socket.data.role = resolved.role;
    next();
  });

  io.on('connection', (socket) => {
    const { session, role } = socket.data;
    if (!store.isActive(session)) {
      socket.emit('session:ended', { reason: 'expired' });
      socket.disconnect(true);
      return;
    }

    socket.join(baseRoom(session));
    if (role === 'receiver') socket.join(receiverRoom(session));
    store.addSocket(session, role, socket.id);

    socket.emit('session:state', stateForRole(session, role));
    broadcastPresence(session);

    if (role === 'sender') {
      store.touch(session, { force: true, reason: 'sender-connected' });
    }

    socket.on('disconnect', () => {
      store.removeSocket(session, role, socket.id);
      broadcastPresence(session);
    });
  });

  const onActivity = ({ session }) => {
    if (!store.isActive(session)) return;
    io.to(baseRoom(session)).emit('session:updated', {
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
    });
  };

  const onSessionEnded = ({ session, reason }) => {
    const room = baseRoom(session);
    io.to(room).emit('session:ended', { reason });
    const timer = setTimeout(() => {
      io.in(room).disconnectSockets(true);
    }, 300);
    timer.unref?.();
  };

  const onFileExpired = ({ session, file }) => {
    io.to(receiverRoom(session)).emit('file:expired', { fileId: file.id });
  };

  const onPresenceChanged = ({ session }) => {
    broadcastPresence(session);
  };

  store.on('activity', onActivity);
  store.on('sessionEnded', onSessionEnded);
  store.on('fileExpired', onFileExpired);
  store.on('presenceChanged', onPresenceChanged);

  return {
    io,
    emitFile(session, file) {
      io.to(receiverRoom(session)).emit('file:new', { file: serializeFile(file) });
    },
    emitMessage(session, message) {
      io.to(receiverRoom(session)).emit('message:new', {
        message: serializeMessage(message),
      });
    },
    emitTransferStart(session, upload) {
      io.to(receiverRoom(session)).emit('transfer:start', {
        uploadId: upload.id,
        name: upload.name,
        totalBytes: upload.size,
      });
    },
    emitTransferProgress(session, upload) {
      io.to(receiverRoom(session)).emit('transfer:progress', {
        uploadId: upload.id,
        name: upload.name,
        receivedBytes: upload.bytesReceived,
        totalBytes: upload.size,
        percent: Math.min(100, Math.round((upload.bytesReceived / upload.size) * 100)),
      });
    },
    emitTransferEnd(session, upload, { failed = false } = {}) {
      io.to(receiverRoom(session)).emit('transfer:end', {
        uploadId: upload.id,
        failed,
      });
    },
    broadcastPresence,
    async close() {
      store.off('activity', onActivity);
      store.off('sessionEnded', onSessionEnded);
      store.off('fileExpired', onFileExpired);
      store.off('presenceChanged', onPresenceChanged);
      await new Promise((resolve) => io.close(resolve));
    },
  };
}
