import React from 'react';
import { HardHat } from 'lucide-react';

export default function BrandMark({ size = 32, icon = 17, className = '' }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-[9px] bg-accent text-white shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <HardHat width={icon} height={icon} strokeWidth={1.8} />
    </span>
  );
}
