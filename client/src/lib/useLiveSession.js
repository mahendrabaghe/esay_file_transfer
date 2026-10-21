import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, ApiError, SOCKET_URL } from './api.js';

const EMPTY_PRESENCE = {
  senders: 0,
  receivers: 0,
  receiving: false,
  connected: false,
};

export function useLiveSession(token, expectedRole) {
  const [phase, setPhase] = useState('loading');
  const [endReason, setEndReason] = useState('expired');
  const [session, setSession] = useState(null);
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [presence, setPresence] = useState(EMPTY_PRESENCE);
  const [transfers, setTransfers] = useState([]);
  const [sharePath, setSharePath] = useState(null);
  const [channel, setChannel] = useState('connecting');
  const [error, setError] = useState(null);
  const requestId = useRef(0);
  const everConnected = useRef(false);
  const clockSkew = useRef(0);

  const applyClockSkew = useCallback((rawSession) => {
    if (!rawSession || typeof rawSession.expiresAt !== 'number') return rawSession;
    return { ...rawSession, expiresAt: rawSession.expiresAt - clockSkew.current };
  }, []);

  const endLocally = useCallback((reason = 'expired') => {
    setEndReason(reason === 'stopped' ? 'stopped' : 'expired');
    setPhase('ended');
  }, []);

  const refresh = useCallback(async () => {
    if (!token) {
      setPhase('not-found');
      return;
    }
    const currentRequest = ++requestId.current;
    setPhase('loading');
    setError(null);

    try {
      const data = await api.getSession(token);
      if (currentRequest !== requestId.current) return;
      if (data.role !== expectedRole) {
        setPhase('invalid-link');
        return;
      }
      if (Number.isFinite(data.serverTime)) {
        clockSkew.current = data.serverTime - Date.now();
      }
      const nextSession = applyClockSkew(data.session);
      setSession(nextSession);
      setPresence(nextSession?.presence || EMPTY_PRESENCE);
      if (expectedRole === 'receiver') {
        setFiles(data.files || []);
        setMessages(data.messages || []);
        setSharePath(data.sharePath || null);
      }
      setPhase('ready');
    } catch (caught) {
      if (currentRequest !== requestId.current) return;
      if (caught instanceof ApiError) {
        if (caught.status === 410) {
          setEndReason('expired');
          setPhase('ended');
        } else if (caught.status === 404) {
          setPhase('not-found');
        } else if (caught.status === 403) {
          setPhase('invalid-link');
        } else {
          setError(caught.message);
          setPhase('error');
        }
      } else {
        setError(caught?.message || 'Could not reach QuickDrop.');
        setPhase('error');
      }
    }
  }, [applyClockSkew, expectedRole, token]);

  useEffect(() => {
    setSession(null);
    setFiles([]);
    setMessages([]);
    setPresence(EMPTY_PRESENCE);
    setTransfers([]);
    setSharePath(null);
    setEndReason('expired');
    setError(null);
    setChannel('connecting');
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (phase !== 'ready' || !token) return undefined;

    everConnected.current = false;
    setChannel('connecting');

    const socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 700,
      reconnectionDelayMax: 6000,
      randomizationFactor: 0.4,
      timeout: 12000,
    });

    const onConnect = () => {
      everConnected.current = true;
      setChannel('connected');
    };
    const onDisconnect = () => {
      setChannel(everConnected.current ? 'reconnecting' : 'connecting');
    };
    const onConnectError = (caught) => {
      setChannel(everConnected.current ? 'reconnecting' : 'connecting');
      const message = String(caught?.message || caught || '');
      if (message.includes('SESSION_EXPIRED') || message.includes('SESSION_NOT_FOUND')) {
        socket.disconnect();
        setEndReason('expired');
        setPhase('ended');
      }
    };
    const onState = (state) => {
      if (!state?.session) return;
      const nextSession = applyClockSkew(state.session);
      setSession(nextSession);
      setPresence(nextSession.presence || EMPTY_PRESENCE);
      if (expectedRole === 'receiver') {
        setFiles(state.files || []);
        setMessages(state.messages || []);
        if (state.sharePath) setSharePath(state.sharePath);
        setTransfers([]);
      }
      setChannel('connected');
    };
    const onSessionUpdated = (update) => {
      setSession((current) =>
        current
          ? {
              ...current,
              expiresAt:
                typeof update.expiresAt === 'number'
                  ? update.expiresAt - clockSkew.current
                  : current.expiresAt,
              lastActivityAt: update.lastActivityAt,
            }
          : current,
      );
    };
    const onPresence = (nextPresence) => setPresence(nextPresence || EMPTY_PRESENCE);
    const onFile = ({ file }) => {
      if (!file) return;
      setFiles((current) => [...current.filter((item) => item.id !== file.id), file]);
    };
    const onFileExpired = ({ fileId }) => {
      setFiles((current) => current.filter((item) => item.id !== fileId));
    };
    const onMessage = ({ message }) => {
      if (!message) return;
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
    };
    const onTransferStart = (transfer) => {
      setTransfers((current) => [
        ...current.filter((item) => item.uploadId !== transfer.uploadId),
        { ...transfer, receivedBytes: 0, percent: 0 },
      ]);
    };
    const onTransferProgress = (transfer) => {
      setTransfers((current) => {
        const next = {
          ...transfer,
          receivedBytes: transfer.receivedBytes ?? 0,
          totalBytes: transfer.totalBytes ?? 0,
          percent: transfer.percent ?? 0,
        };
        const exists = current.some((item) => item.uploadId === transfer.uploadId);
        if (!exists) return [...current, next];
        return current.map((item) => (item.uploadId === transfer.uploadId ? { ...item, ...next } : item));
      });
    };
    const onTransferEnd = ({ uploadId }) => {
      setTransfers((current) => current.filter((item) => item.uploadId !== uploadId));
    };
    const onEnded = ({ reason }) => {
      socket.disconnect();
      setEndReason(reason === 'stopped' ? 'stopped' : 'expired');
      setPhase('ended');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('session:state', onState);
    socket.on('session:updated', onSessionUpdated);
    socket.on('presence', onPresence);
    socket.on('file:new', onFile);
    socket.on('file:expired', onFileExpired);
    socket.on('message:new', onMessage);
    socket.on('transfer:start', onTransferStart);
    socket.on('transfer:progress', onTransferProgress);
    socket.on('transfer:end', onTransferEnd);
    socket.on('session:ended', onEnded);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [applyClockSkew, expectedRole, phase, token]);

  useEffect(() => {
    if (!presence.receiving) setTransfers([]);
  }, [presence.receiving]);

  useEffect(() => {
    if (phase !== 'ready' || channel !== 'connected' || !session?.expiresAt) return undefined;
    const delay = Math.max(0, session.expiresAt - Date.now()) + 1500;
    const timer = setTimeout(() => endLocally('expired'), delay);
    return () => clearTimeout(timer);
  }, [channel, endLocally, phase, session?.expiresAt]);

  const upsertFile = useCallback((file) => {
    if (!file) return;
    setFiles((current) => [...current.filter((item) => item.id !== file.id), file]);
  }, []);

  return {
    phase,
    endReason,
    session,
    files,
    messages,
    presence,
    transfers,
    sharePath,
    channel,
    error,
    refresh,
    upsertFile,
    endLocally,
  };
}
