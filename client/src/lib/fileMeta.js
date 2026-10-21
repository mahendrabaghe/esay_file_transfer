const IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif', 'bmp', 'tif', 'tiff',
];
const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'mov', 'webm', 'ogv', 'avi', 'mkv', 'mpg', 'mpeg', '3gp'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac'];
const DOCUMENT_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf',
  'odt', 'ods', 'odp', 'epub', 'json', 'yaml', 'yml', 'xml',
];
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz'];

export const PHOTO_EXTENSIONS = new Set(IMAGE_EXTENSIONS);
export const VIDEO_EXTENSIONS_SET = new Set(VIDEO_EXTENSIONS);

export const ALLOWED_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
  ...ARCHIVE_EXTENSIONS,
]);

export const ACCEPT = {
  photos: [...IMAGE_EXTENSIONS].map((extension) => `.${extension}`).join(','),
  videos: [...VIDEO_EXTENSIONS].map((extension) => `.${extension}`).join(','),
  documents: [...DOCUMENT_EXTENSIONS, ...ARCHIVE_EXTENSIONS, ...AUDIO_EXTENSIONS]
    .map((extension) => `.${extension}`)
    .join(','),
};

export function getExtension(name = '') {
  const clean = name.split(/[\\/]/).pop() || '';
  const dot = clean.lastIndexOf('.');
  if (dot <= 0 || dot === clean.length - 1) return '';
  return clean.slice(dot + 1).toLowerCase();
}

export function isAllowedFile(file) {
  return ALLOWED_EXTENSIONS.has(getExtension(file.name));
}

export function getFileKind(name, fallback = 'file') {
  const extension = getExtension(name);
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
  if (AUDIO_EXTENSIONS.includes(extension)) return 'audio';
  if (ARCHIVE_EXTENSIONS.includes(extension)) return 'archive';
  if (DOCUMENT_EXTENSIONS.includes(extension)) return 'document';
  return fallback;
}

export function fileTypeLabel(nameOrKind) {
  const kind = ['image', 'video', 'audio', 'archive', 'document', 'file'].includes(nameOrKind)
    ? nameOrKind
    : getFileKind(nameOrKind);
  return {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    archive: 'Archive',
    document: 'Document',
    file: 'File',
  }[kind];
}

export function validateSelection(files, { existingFiles = [], limits }) {
  const accepted = [];
  const rejected = [];
  const seen = new Set(
    existingFiles.map((file) => `${file.name}:${file.size}:${file.lastModified || ''}`),
  );
  const maxFileSize = limits?.maxFileSizeBytes ?? Infinity;
  const maxFiles = limits?.maxFilesPerSession ?? Infinity;

  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified || ''}`;
    if (!isAllowedFile(file)) {
      rejected.push({ file, reason: `${file.name} is not a supported file type.` });
      continue;
    }
    if (file.size <= 0) {
      rejected.push({ file, reason: `${file.name} is empty.` });
      continue;
    }
    if (file.size > maxFileSize) {
      rejected.push({ file, reason: `${file.name} is larger than the session file limit.` });
      continue;
    }
    if (seen.has(key)) continue;
    if (existingFiles.length + accepted.length >= maxFiles) {
      rejected.push({ file, reason: `You can add up to ${maxFiles} files to one drop.` });
      continue;
    }
    seen.add(key);
    accepted.push(file);
  }

  return { accepted, rejected };
}
