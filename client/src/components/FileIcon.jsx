import { File, FileArchive, FileAudio, FileText, FileVideo, Image as ImageIcon } from 'lucide-react';

const ICONS = {
  image: ImageIcon,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  document: FileText,
  file: File,
};

const TONES = {
  image: 'bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300',
  video: 'bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300',
  audio: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-400/10 dark:text-fuchsia-300',
  archive: 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300',
  document: 'bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300',
  file: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300',
};

export default function FileIcon({ kind = 'file', size = 'md', className = '' }) {
  const Icon = ICONS[kind] || File;
  const sizes = {
    sm: 'h-9 w-9 rounded-xl [&>svg]:h-4 [&>svg]:w-4',
    md: 'h-11 w-11 rounded-[14px] [&>svg]:h-5 [&>svg]:w-5',
    lg: 'h-14 w-14 rounded-2xl [&>svg]:h-6 [&>svg]:w-6',
  };
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${sizes[size] || sizes.md} ${
        TONES[kind] || TONES.file
      } ${className}`}
      aria-hidden="true"
    >
      <Icon strokeWidth={1.9} />
    </span>
  );
}
