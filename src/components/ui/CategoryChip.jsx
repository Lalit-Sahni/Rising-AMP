import React from 'react';
import { getCategoryStyle } from '../../utils/categoryStyle';

export default function CategoryChip({ category, className = '' }) {
  const style = getCategoryStyle(category);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-slate-600 ${className}`}>
      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: style.hex }} />
      {style.label}
    </span>
  );
}
