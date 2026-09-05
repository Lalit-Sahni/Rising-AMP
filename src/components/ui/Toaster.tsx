import React from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: number;
  message: string;
  kind: ToastKind;
};

type ToasterProps = {
  toasts: Toast[];
  onDismiss: (id: number) => void;
};

const TONE: Record<ToastKind, { icon: typeof Check; well: string; border: string }> = {
  success: { icon: Check, well: 'bg-pos-tint text-pos', border: 'border-l-pos' },
  error: { icon: AlertTriangle, well: 'bg-[#F9E9E7] text-neg', border: 'border-l-neg' },
  warning: { icon: AlertTriangle, well: 'bg-warn-tint text-warn', border: 'border-l-warn' },
  info: { icon: Info, well: 'bg-canvas text-slate-600', border: 'border-l-slate-400' },
};

/**
 * Small, honest confirmations. Bottom of the screen on a phone (above the tab
 * bar), bottom-right on a desktop. Errors stay longer than successes.
 */
export default function Toaster({ toasts, onDismiss }: ToasterProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="toaster pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-5 md:items-end"
      style={{ bottom: 'calc(var(--toaster-offset, 0px) + var(--safe-bottom) + 14px)' }}
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => {
        const tone = TONE[toast.kind] || TONE.info;
        const Icon = tone.icon;
        return (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className={`toast-enter pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-ot border border-hairline ${tone.border} border-l-[3px] bg-surface px-3.5 py-3 shadow-[0_8px_28px_rgba(23,24,28,0.14)]`}
          >
            <span className={`mt-px grid h-7 w-7 shrink-0 place-items-center rounded-[8px] ${tone.well}`}>
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <p className="min-w-0 flex-1 pt-[3px] text-[13px] font-semibold leading-snug text-ink">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-ot-sm text-slate-400 hover:bg-canvas hover:text-ink"
              aria-label="Dismiss"
              style={{ minHeight: 32, minWidth: 32 }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
