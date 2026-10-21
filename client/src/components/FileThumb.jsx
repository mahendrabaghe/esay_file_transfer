import { useEffect, useState } from 'react';
import FileIcon from './FileIcon.jsx';

export default function FileThumb({ file, className = '', iconKind }) {
  const [url, setUrl] = useState(null);
  const isImage = file.type?.startsWith('image/') || iconKind === 'image';

  useEffect(() => {
    if (!isImage) return undefined;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, isImage]);

  if (isImage && url) {
    return (
      <span className={`relative block overflow-hidden rounded-xl bg-subtle ${className}`}>
        <img src={url} alt="" className="h-full w-full object-cover" draggable="false" />
      </span>
    );
  }

  return (
    <span className={`flex items-center justify-center rounded-xl bg-subtle ${className}`}>
      <FileIcon kind={iconKind || 'file'} size="sm" />
    </span>
  );
}
