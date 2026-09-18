/**
 * Brand-aligned picker. Native <select> is the Airtable look: grey, clipped
 * by overflow, and on a phone two of them fight for one row. This opens a
 * bottom sheet under 768px and a portaled menu on desktop so History cells
 * cannot clip it.
 */
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';

export type QuietSelectOption = {
  value: string;
  label: string;
  color?: string;
};

type QuietSelectProps = {
  value: string;
  options: QuietSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  ariaLabel: string;
  title: string;
  placeholder?: string;
};

function uniqueOptions(options: QuietSelectOption[]): QuietSelectOption[] {
  const seen = new Set<string>();
  const out: QuietSelectOption[] = [];
  options.forEach((option) => {
    const key = option.value === '' ? '__empty' : option.value;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(option);
  });
  return out;
}

function isPhone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export default function QuietSelect({
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
  ariaLabel,
  title,
  placeholder = 'Choose',
}: QuietSelectProps) {
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const rows = useMemo(() => uniqueOptions(options), [options]);
  const selected = rows.find((row) => row.value === value);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setPhone(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    const previousOverflow = document.body.style.overflow;
    if (phone) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, phone]);

  useLayoutEffect(() => {
    if (!open || phone) {
      setMenuStyle({});
      return undefined;
    }
    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = Math.max(rect.width, 220);
      const maxHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const openUp = spaceBelow < 180 && rect.top > spaceBelow;
      setMenuStyle({
        position: 'fixed',
        left: Math.min(rect.left, window.innerWidth - width - 12),
        width,
        maxHeight,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, phone]);

  const pick = (next: string) => {
    setOpen(false);
    if (next === value) return;
    onChange(next);
  };

  const menu = open && typeof document !== 'undefined'
    ? createPortal(
      phone ? (
        <div className="fixed inset-0 z-[80]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-steel-900/40"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            ref={menuRef}
            role="listbox"
            id={listId}
            aria-label={ariaLabel}
            className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[16px] bg-surface shadow-[0_-8px_32px_rgba(23,24,28,.12)]"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="eyebrow">{title}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 grid place-items-center rounded-ot-sm text-slate-500"
                aria-label="Close"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
            <div className="px-2 pb-2">
              {rows.map((row) => (
                <OptionRow
                  key={row.value || '__empty'}
                  option={row}
                  selected={row.value === value}
                  onPick={pick}
                />
              ))}
            </div>
          </div>
        </div>
      ) : menuStyle.top != null || menuStyle.bottom != null ? (
        <div
          ref={menuRef}
          role="listbox"
          id={listId}
          aria-label={ariaLabel}
          className="fixed z-[80] overflow-y-auto rounded-ot border border-hairline bg-surface py-1 shadow-whisper"
          style={menuStyle}
        >
          {rows.map((row) => (
            <OptionRow
              key={row.value || '__empty'}
              option={row}
              selected={row.value === value}
              onPick={pick}
            />
          ))}
        </div>
      ) : null,
      document.body,
    )
    : null;

  return (
    <div className={compact ? 'min-w-[10.5rem]' : 'min-w-0'} onClick={(event) => event.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          if (disabled) return;
          setPhone(isPhone());
          setOpen((current) => !current);
        }}
        className={`w-full inline-flex items-center gap-2 rounded-ot-sm border bg-canvas text-left font-medium ${
          compact ? 'min-h-[36px] px-2.5 text-[12.5px]' : 'min-h-[40px] px-3 text-[13px]'
        } ${
          disabled
            ? 'border-hairline text-slate-400'
            : open
              ? 'border-accent text-ink'
              : 'border-hairline text-ink hover:border-[#D6D9DD]'
        }`}
      >
        {selected?.color ? (
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
        ) : null}
        <span className={`flex-1 min-w-0 truncate ${selected ? '' : 'text-slate-400 font-normal'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-400 ${open ? 'rotate-180' : ''}`} strokeWidth={1.8} />
      </button>
      {menu}
    </div>
  );
}

function OptionRow({
  option,
  selected,
  onPick,
}: {
  option: QuietSelectOption;
  selected: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onPick(option.value)}
      className={`w-full min-h-[44px] md:min-h-[36px] px-3 inline-flex items-center gap-2.5 text-left text-[13.5px] md:text-[13px] ${
        selected ? 'bg-accent-tint text-ink font-semibold' : 'text-ink hover:bg-canvas'
      }`}
    >
      {option.color ? (
        <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: option.color }} />
      ) : null}
      <span className="flex-1 min-w-0 truncate">{option.label}</span>
      {selected ? <Check className="w-3.5 h-3.5 text-accent shrink-0" strokeWidth={2.2} /> : null}
    </button>
  );
}

export { uniqueOptions };
