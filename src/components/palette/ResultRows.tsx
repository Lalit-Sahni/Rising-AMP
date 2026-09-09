import React from 'react';
import type {
  AnswerWorking,
  FactAnswer,
  FileHit,
  InvoiceHit,
  PortfolioAnswer,
  RefusalAnswer,
  SpendAnswer,
} from './answers';

export function WorkingLine({
  working,
  onOpenRows,
}: {
  working: AnswerWorking;
  onOpenRows?: (event: React.MouseEvent) => void;
}) {
  const content = (
    <>
      <span>Worked out by</span>
      {' '}
      <code className="rounded-[4px] bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
        {working.call}
      </code>
      {working.detail ? <span> · {working.detail}</span> : null}
    </>
  );
  const className = 'mt-3 flex w-full flex-wrap items-center gap-1.5 border-t border-hairline pt-2.5 text-left text-[11.5px] text-slate-400';
  if (onOpenRows) {
    return (
      <button type="button" onClick={onOpenRows} className={`${className} cursor-pointer`}>
        {content}
      </button>
    );
  }
  return <span className={className}>{content}</span>;
}

function IncompleteNote({ text }: { text?: string }) {
  if (!text) return null;
  return <span className="mt-1.5 block text-[12px] leading-snug text-slate-600">{text}</span>;
}

function UncodedNote({
  warning,
  onCodeThem,
}: {
  warning?: string;
  onCodeThem?: (event: React.MouseEvent) => void;
}) {
  if (!warning) return null;
  return (
    <span className="mt-1.5 block text-[12px] leading-snug text-slate-600">
      {warning}
      {onCodeThem ? (
        <>
          {' '}
          <button
            type="button"
            onClick={onCodeThem}
            className="font-bold text-accent"
          >
            Code them
          </button>
        </>
      ) : null}
    </span>
  );
}

export function RefusalAnswerBody({
  row,
  onCodeThem,
  onOpenWorking,
  onOpenOverview,
}: {
  row: RefusalAnswer;
  onCodeThem?: (event: React.MouseEvent) => void;
  onOpenWorking?: (event: React.MouseEvent) => void;
  onOpenOverview?: (event: React.MouseEvent) => void;
}) {
  const showCodeThem = Boolean(onCodeThem && (row.refusalReason === 'nothing_coded' || row.affected));
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[13.5px] font-extrabold text-ink">{row.title}</span>
      <span className="mt-0.5 block text-[12px] text-slate-500">{row.detail}</span>
      {row.known && row.known.length > 0 ? (
        <span className="mt-3 flex flex-wrap gap-5">
          {row.known.map((fig) => (
            <span key={fig.label}>
              <span className="block tabular text-[21px] font-extrabold text-ink">{fig.amount}</span>
              <span className="block text-[12px] text-slate-500">{fig.label}</span>
            </span>
          ))}
        </span>
      ) : null}
      <IncompleteNote text={row.incomplete} />
      <UncodedNote warning={row.warning} onCodeThem={showCodeThem && row.warning ? onCodeThem : undefined} />
      {showCodeThem && !row.warning ? (
        <span className="mt-1.5 block text-[12px] leading-snug text-slate-600">
          <button
            type="button"
            onClick={onCodeThem}
            className="font-bold text-accent"
          >
            Code them
          </button>
        </span>
      ) : null}
      {row.refusalReason === 'fact_missing' && onOpenOverview ? (
        <span className="mt-1.5 block text-[12px] leading-snug text-slate-600">
          <button
            type="button"
            onClick={onOpenOverview}
            className="font-bold text-accent"
          >
            Overview
          </button>
        </span>
      ) : row.actionNote && row.refusalReason === 'fact_missing' ? (
        <span className="mt-1.5 block text-[12px] leading-snug text-slate-600">{row.actionNote}</span>
      ) : null}
      {row.working ? <WorkingLine working={row.working} onOpenRows={onOpenWorking} /> : null}
    </span>
  );
}

export function FactAnswerBody({
  row,
  onOpenWorking,
}: {
  row: FactAnswer;
  onOpenWorking?: (event: React.MouseEvent) => void;
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[13.5px] font-extrabold text-ink">{row.title}</span>
      <span className="mt-0.5 block text-[12px] text-slate-500">{row.detail}</span>
      {row.working ? <WorkingLine working={row.working} onOpenRows={onOpenWorking} /> : null}
    </span>
  );
}

export function SpendAnswerBody({
  row,
  onCodeThem,
  onOpenWorking,
}: {
  row: SpendAnswer | PortfolioAnswer | RefusalAnswer;
  onCodeThem?: (event: React.MouseEvent) => void;
  onOpenWorking?: (event: React.MouseEvent) => void;
}) {
  if (row.kind === 'none') {
    return (
      <RefusalAnswerBody
        row={row}
        onCodeThem={onCodeThem}
        onOpenWorking={onOpenWorking}
      />
    );
  }
  const spend = row.kind === 'spend' ? row as SpendAnswer : null;
  const warning = spend?.warning;
  const working = row.working;
  const incomplete = row.incomplete;
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[13.5px] font-extrabold text-ink">{row.title}</span>
          <span className="mt-0.5 block text-[12px] text-slate-500">{row.detail}</span>
          <IncompleteNote text={incomplete} />
          <UncodedNote warning={warning} onCodeThem={onCodeThem} />
        </span>
        <span className="shrink-0 text-right">
          <span className="block tabular text-[15px] font-extrabold text-ink">{row.amount}</span>
          <span className="block text-[11px] text-slate-500">paid</span>
        </span>
      </span>
      {working ? <WorkingLine working={working} onOpenRows={onOpenWorking} /> : null}
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
  const quote = hit.quote;
  const unreadable = hit.match === 'unreadable' ? hit.unreadableDetail : undefined;
  const weak = hit.match === 'weak';
  return (
    <span className="min-w-0 flex-1">
      {quote ? (
        <span className="mb-2 block border-l-2 border-hairline pl-3 text-[13.5px] leading-snug text-ink whitespace-pre-wrap">
          {quote}
        </span>
      ) : unreadable ? (
        <span className="mb-1 block text-[13.5px] font-extrabold text-ink">{unreadable}</span>
      ) : weak ? (
        <span className="mb-1 block text-[13.5px] font-extrabold text-ink">No matching passage in this file.</span>
      ) : null}
      <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: hit.typeColor }} />
        <span className="truncate">{hit.name}</span>
      </span>
      <span className="block truncate text-[12px] text-slate-400">{hit.detail}</span>
      {hit.working ? <WorkingLine working={hit.working} /> : null}
    </span>
  );
}
