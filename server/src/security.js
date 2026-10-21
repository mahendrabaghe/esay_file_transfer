import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { ApiError } from './errors.js';

const FILE_TYPES = {
  jpg: ['image', 'image/jpeg'],
  jpeg: ['image', 'image/jpeg'],
  png: ['image', 'image/png'],
  gif: ['image', 'image/gif'],
  webp: ['image', 'image/webp'],
  avif: ['image', 'image/avif'],
  heic: ['image', 'image/heic'],
  heif: ['image', 'image/heif'],
  bmp: ['image', 'image/bmp'],
  tif: ['image', 'image/tiff'],
  tiff: ['image', 'image/tiff'],

  mp4: ['video', 'video/mp4'],
  m4v: ['video', 'video/x-m4v'],
  mov: ['video', 'video/quicktime'],
  webm: ['video', 'video/webm'],
  ogv: ['video', 'video/ogg'],
  avi: ['video', 'video/x-msvideo'],
  mkv: ['video', 'video/x-matroska'],
  mpg: ['video', 'video/mpeg'],
  mpeg: ['video', 'video/mpeg'],
  '3gp': ['video', 'video/3gpp'],

  mp3: ['audio', 'audio/mpeg'],
  wav: ['audio', 'audio/wav'],
  m4a: ['audio', 'audio/mp4'],
  aac: ['audio', 'audio/aac'],
  ogg: ['audio', 'audio/ogg'],
  oga: ['audio', 'audio/ogg'],
  flac: ['audio', 'audio/flac'],

  pdf: ['document', 'application/pdf'],
  doc: ['document', 'application/msword'],
  docx: ['document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['document', 'application/vnd.ms-excel'],
  xlsx: ['document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['document', 'application/vnd.ms-powerpoint'],
  pptx: ['document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['document', 'text/plain; charset=utf-8'],
  md: ['document', 'text/markdown; charset=utf-8'],
  csv: ['document', 'text/csv; charset=utf-8'],
  rtf: ['document', 'application/rtf'],
  odt: ['document', 'application/vnd.oasis.opendocument.text'],
  ods: ['document', 'application/vnd.oasis.opendocument.spreadsheet'],
  odp: ['document', 'application/vnd.oasis.opendocument.presentation'],
  epub: ['document', 'application/epub+zip'],
  json: ['document', 'application/json; charset=utf-8'],
  yaml: ['document', 'text/yaml; charset=utf-8'],
  yml: ['document', 'text/yaml; charset=utf-8'],
  xml: ['document', 'application/xml'],

  zip: ['archive', 'application/zip'],
  rar: ['archive', 'application/x-rar-compressed'],
  '7z': ['archive', 'application/x-7z-compressed'],
  tar: ['archive', 'application/x-tar'],
  gz: ['archive', 'application/gzip'],
  tgz: ['archive', 'application/gzip'],
  bz2: ['archive', 'application/x-bzip2'],
  xz: ['archive', 'application/x-xz'],
};

const SESSION_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function createToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function createSessionId(length = 8) {
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += SESSION_ALPHABET[randomInt(SESSION_ALPHABET.length)];
  }
  return output;
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function safeTokenEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sanitizeFileName(input) {
  const raw = String(input || '');
  const base = path.posix.basename(raw.replace(/\\/g, '/'));
  let clean = base
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');

  if (!clean) return null;

  const characters = Array.from(clean);
  if (characters.length > 160) {
    const extIndex = clean.lastIndexOf('.');
    const extension = extIndex > 0 ? path.extname(clean).slice(0, 12) : '';
    clean = `${characters.slice(0, 156 - extension.length).join('')}${extension}`;
  }
  return clean;
}

export function getFileExtension(name) {
  const extension = path.extname(name).slice(1).toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(extension) ? extension : null;
}

export function inspectFile(name, size) {
  const safeName = sanitizeFileName(name);
  if (!safeName) {
    throw new ApiError(400, 'INVALID_FILE_NAME', 'That file name is not supported.');
  }

  const extension = getFileExtension(safeName);
  const type = extension ? FILE_TYPES[extension] : null;
  if (!type) {
    throw new ApiError(
      415,
      'FILE_TYPE_NOT_ALLOWED',
      'This file type is not supported. Try photos, videos, documents, audio, or archives.',
    );
  }

  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new ApiError(400, 'INVALID_FILE_SIZE', 'Empty files cannot be transferred.');
  }

  return {
    name: safeName,
    extension,
    kind: type[0],
    mimeType: type[1],
  };
}

export function uniqueFileName(name, existingNames) {
  const names = new Set([...existingNames].map((item) => item.toLowerCase()));
  if (!names.has(name.toLowerCase())) return name;

  const extension = path.extname(name);
  const stem = extension ? name.slice(0, -extension.length) : name;
  let counter = 2;
  let candidate = `${stem} (${counter})${extension}`;
  while (names.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${stem} (${counter})${extension}`;
  }
  return candidate;
}

export function validateMessage(type, rawContent, maxLength) {
  if (!['text', 'link'].includes(type)) {
    throw new ApiError(400, 'INVALID_MESSAGE_TYPE', 'Messages must be text or links.');
  }

  const content = String(rawContent ?? '').replace(/\u0000/g, '').trim();
  if (!content) {
    throw new ApiError(400, 'EMPTY_MESSAGE', type === 'link' ? 'Paste a link to send.' : 'Write something to send.');
  }

  if (content.length > maxLength) {
    throw new ApiError(400, 'MESSAGE_TOO_LONG', `Messages can be up to ${maxLength.toLocaleString()} characters.`);
  }

  if (type === 'link') {
    let parsed;
    try {
      parsed = new URL(content);
    } catch {
      throw new ApiError(400, 'INVALID_LINK', 'Enter a complete link beginning with http:// or https://.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ApiError(400, 'INVALID_LINK', 'Only http and https links are supported.');
    }
    return { type, content: parsed.toString(), href: parsed.toString() };
  }

  return { type, content };
}

export function isImageFile(file) {
  return file.kind === 'image';
}

export function fingerprintIsValid(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

export function formatSessionCode(id) {
  return `QD-${id.slice(0, 4)}-${id.slice(4)}`;
}
