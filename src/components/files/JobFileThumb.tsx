import React, { useEffect, useState } from 'react';
import { filesDrawerMeta, jobFileTypeIconLabel, type FilesDrawerType } from '../../domain/jobFiles';
import { getDownloadUrlForPath } from '../../firebase/storage';

type JobFileThumbProps = {
  thumbnailPath?: string | null;
  contentType: string;
  type?: FilesDrawerType;
  alt?: string;
  size?: number;
  className?: string;
};

/**
 * Lists and grids must pass thumbnailPath, never the original storagePath.
 */
export default function JobFileThumb({
  thumbnailPath,
  contentType,
  type,
  alt = '',
  size = 44,
  className = '',
}: JobFileThumbProps) {
  const [url, setUrl] = useState<string | null>(null);
  const label = jobFileTypeIconLabel(contentType);
  const color = (type && filesDrawerMeta(type)?.color) || '#8A9099';

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
      className={`shrink-0 rounded-ot-sm overflow-hidden bg-canvas border border-hairline grid place-items-center ${className}`}
      style={className.includes('w-full') ? undefined : { width: size, height: size }}
      aria-hidden={alt ? undefined : true}
    >
      {url ? (
        <img src={url} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[9px] font-extrabold tracking-wide" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}
