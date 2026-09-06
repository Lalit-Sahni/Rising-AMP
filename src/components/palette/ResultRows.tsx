import React from 'react';
import type { FileHit, InvoiceHit, PaletteAnswer } from './answers';

export function SpendAnswerBody({ row }: { row: PaletteAnswer }) {
  return (
    <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-extrabold text-ink">{row.title}</span>
        <span className="block truncate text-[12px] text-slate-500">{row.detail}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block tabular text-[15px] font-extrabold text-ink">{row.amount}</span>
        <span className="block text-[11px] text-slate-500">paid</span>
      </span>
    </span>
  );
}

function invoiceTone(hit: InvoiceHit): string {
  if (hit.status === 'paid') return 'text-pos bg-pos-tint';
  if (hit.overdue || hit.status === 'overdue') return 'text-neg bg-[#F9E9E7]';
  if (hit.status === 'sent') return 'text-ink bg-canvas border border-hairline';
  return 'text-slate-600 bg-canvas border border-hairline';
}

export function InvoiceAnswerBody({ hit }: { hit: InvoiceHit }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate tabular text-[14px] font-extrabold text-ink">
            {hit.invoiceNumber || 'Draft'}
          </span>
          {hit.clientName ? (
            <span className="mt-0.5 block truncate text-[13px] text-ink">{hit.clientName}</span>
          ) : null}
          <span className="mt-0.5 block text-[12px] text-slate-400">
            Issued {hit.issuedLabel} · Due {hit.dueLabel}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block tabular text-[15px] font-extrabold text-ink">{hit.amount}</span>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[12px] font-bold ${invoiceTone(hit)}`}>
            {hit.statusLabel}
          </span>
        </span>
      </span>
    </span>
  );
}

export function FileAnswerBody({ hit }: { hit: FileHit }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: hit.typeColor }} />
        <span className="truncate">{hit.name}</span>
      </span>
      <span className="block truncate text-[12px] text-slate-400">{hit.detail}</span>
    </span>
  );
}
