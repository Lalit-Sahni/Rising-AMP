import React, { useEffect, useState } from 'react';
import { isRasterImageContentType, jobFileTypeIconLabel } from '../../domain/jobFiles';
import { getDownloadUrlForPath } from '../../firebase/storage';

type JobFilePreviewProps = {
  originalPath: string | null;
  originalUrl: string | null;
  contentType: string;
  name: string;
};

/**
 * Viewer only. Lists must never call this with a full-size path.
 */
export default function JobFilePreview({
  originalPath,
  originalUrl,
  contentType,
  name,
}: JobFilePreviewProps) {
  const [url, setUrl] = useState<string | null>(originalUrl);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    if (originalPath) {
      getDownloadUrlForPath(originalPath).then((next) => {
        if (cancelled) return;
        if (next) setUrl(next);
        else if (!originalUrl) setError('Could not open this file.');
      });
    } else if (originalUrl) {
      setUrl(originalUrl);
    } else {
      setUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [originalPath, originalUrl]);

  if (error) {
    return <p className="text-[13px] text-slate-500 px-1 py-8 text-center">{error}</p>;
  }
  if (!url) {
    return (
      <p className="text-[13px] text-slate-500 px-1 py-8 text-center">
        {jobFileTypeIconLabel(contentType)} — open the file to view it.
      </p>
    );
  }

  if (isRasterImageContentType(contentType)) {
    return (
      <img
        src={url}
        alt={name}
        className="max-h-[42vh] w-full object-contain bg-canvas rounded-ot-sm border border-hairline"
      />
    );
  }

  if (String(contentType || '').toLowerCase() === 'application/pdf') {
    return (
      <div className="space-y-2">
        <iframe
          title={name}
          src={url}
          className="w-full h-[42vh] rounded-ot-sm border border-hairline bg-canvas"
        />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] font-bold text-accent"
        >
          Open PDF
        </a>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block text-center text-[13px] font-bold text-accent min-h-[44px] leading-[44px] border border-hairline rounded-ot-sm"
    >
      Open {name}
    </a>
  );
}
