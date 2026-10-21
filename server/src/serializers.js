export function serializeLimits(config) {
  return {
    maxFileSizeBytes: config.maxFileSizeBytes,
    maxSessionBytes: config.maxSessionBytes,
    maxFilesPerSession: config.maxFilesPerSession,
    maxMessagesPerSession: config.maxMessagesPerSession,
    maxTextLength: config.maxTextLength,
    chunkSizeBytes: config.chunkSizeBytes,
    sessionTtlMs: config.sessionTtlMs,
    fileRetentionMs: config.fileRetentionMs,
  };
}

export function serializeSession(session, config, presence) {
  return {
    id: session.id,
    code: session.code,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    expiresAt: session.expiresAt,
    presence: presence || { senders: 0, receivers: 0, receiving: false, connected: false },
    usage: {
      files: session.files.size,
      messages: session.messages.length,
      bytes: session.totalBytes,
    },
    limits: serializeLimits(config),
  };
}

export function serializeFile(file) {
  const token = encodeURIComponent(file.accessToken);
  return {
    id: file.id,
    name: file.name,
    size: file.size,
    mimeType: file.mimeType,
    kind: file.kind,
    extension: file.extension,
    source: file.source,
    createdAt: file.createdAt,
    expiresAt: file.expiresAt,
    downloadPath: `/api/files/${file.id}/download?token=${token}`,
    previewPath: file.kind === 'image' ? `/api/files/${file.id}/preview?token=${token}` : null,
  };
}

export function serializeMessage(message) {
  return {
    id: message.id,
    type: message.type,
    content: message.content,
    href: message.href || null,
    createdAt: message.createdAt,
  };
}

export function serializeReceiverState(session, config, presence) {
  return {
    sharePath: session.sharePath,
    session: serializeSession(session, config, presence),
    files: [...session.files.values()].map(serializeFile),
    messages: session.messages.map(serializeMessage),
  };
}
