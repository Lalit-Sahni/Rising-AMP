import React from 'react';
import BrandMark from './BrandMark';

export default function BootScreen({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center">
      <BrandMark size={40} icon={21} />
      <p className="mt-4 text-sm text-slate-400">{label}</p>
    </div>
  );
}
