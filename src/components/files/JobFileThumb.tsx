import React, { useEffect, useState } from 'react';
import { Camera, File, FileSpreadsheet, FileText, Image } from 'lucide-react';
import { getDownloadUrlForPath } from '../../firebase/storage';

type JobFileThumbProps = {
  thumbnailPath?: string | null;
  contentType: string;
  /** Ignored. Colour lives on the type column, not this icon. */
  type?: string;
  kind?: 'file' | 'receipt';
  alt?: string;
  size?: number;
  className?: string;
};

function FormatIcon({
  contentType,
  size,
  kind,
}: {
  contentType: string;
  size: number;
  kind?: 'file' | 'receipt';
}) {
  const type = String(contentType || '').toLowerCase();
  const props = { className: 'text-slate-400', strokeWidth: 1.6, size };
  if (kind === 'receipt') return <Camera {...props} />;
  if (type.startsWith('image/')) return <Image {...props} />;
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('ms-excel')) {
    return <FileSpreadsheet {...props} />;
  }
  if (type === 'application/pdf' || type.includes('word') || type.includes('msword') || type === 'text/plain') {
    return <FileText {...props} />;
  }
  return <File {...props} />;
}

/**
 * Lists and grids must pass thumbnailPath, never the original storagePath.
 * Colour belongs on the type column, not on this icon.
 */
export default function JobFileThumb({
  thumbnailPath,
  contentType,
  kind,
  alt = '',
  size = 32,
  className = '',
}: JobFileThumbProps) {
  const [url, setUrl] = useState<string | null>(null);
  const iconSize = Math.max(16, Math.round(size * 0.45));

  useEffect(() => {
    if (!thumbnailPath) {
      setUrl(null);
      return undefined;
    }
    let cancelled = false;
    getDownloadUrlForPath(thumbnailPath).then((next) => {
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [thumbnailPath]);

  return (
    <div
      className={`shrink-0 overflow-hidden bg-canvas border border-hairline grid place-items-center ${className}`}
      style={className.includes('w-full') ? undefined : { width: size, height: size }}
      aria-hidden={alt ? undefined : true}
    >
      {url ? (
        <img src={url} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <FormatIcon contentType={contentType} kind={kind} size={className.includes('w-full') ? 28 : iconSize} />
      )}
    </div>
  );
}
