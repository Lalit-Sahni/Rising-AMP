import React from 'react';
import { addCents, formatCents, lineCents, percentOf, safeParseToCents } from '../../money';
import { parseCalendarDate } from '../../dates';

export type InvoiceBusiness = {
  name: string;
  abn?: string;
  addressLines: string[];
  mobile?: string;
  email?: string;
};

type AnyRecord = Record<string, any>;

const DAY = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

function day(value: unknown): string {
  const date = value instanceof Date ? value : parseCalendarDate(value);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return DAY.format(date);
}

/** The builder's details for the top of an invoice, from the saved profile. */
export function businessFromProfile(profile: AnyRecord | null | undefined, fallbackEmail?: string): InvoiceBusiness {
  const p = profile || {};
  const street = String(p.street || '').trim();
  const locality = [p.suburb, p.state, p.postcode].map((v) => String(v || '').trim()).filter(Boolean).join(' ');
  const mobile = String(p.mobile || '').trim();
  return {
    name: String(p.businessName || '').trim() || String(p.displayName || '').trim() || 'RisingAMP',
    abn: String(p.abn || '').trim() || undefined,
    addressLines: [street, locality].filter(Boolean),
    mobile: mobile ? (mobile.startsWith('0') || mobile.startsWith('+') ? mobile : `0${mobile}`) : undefined,
    email: String(p.email || fallbackEmail || '').trim() || undefined,
  };
}

export function invoiceTotals(invoice: AnyRecord) {
  const lines: AnyRecord[] = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const lineTotals = lines.map((item) => {
    const fromParts = lineCents(item.quantity, item.unitCost);
    return fromParts > 0 || item.total == null ? fromParts : safeParseToCents(item.total);
  });
  const subtotal = addCents(...lineTotals, 0);
  let gst = 0;
  if (invoice.includeGST === true) {
    gst = percentOf(subtotal, 10);
  } else if (invoice.gst != null && invoice.gst !== '' && invoice.includeGST !== false) {
    gst = safeParseToCents(invoice.gst);
  }
  const total = addCents(subtotal, gst);
  return { lineTotals, subtotal, gst, total, hasGst: gst > 0 };
}

type Props = {
  invoice: AnyRecord;
  business: InvoiceBusiness;
  jobName?: string;
  /** Fixed A4 width for the PDF renderer; fluid on screen. */
  fixedWidth?: boolean;
  /** Overrides 'Tax invoice' / 'Invoice', e.g. 'Progress claim'. */
  title?: string;
  /** Replaces the 'No GST charged' footnote when no GST line is shown. */
  gstNote?: string;
};

/**
 * The one invoice layout. The preview shows it, the PDF renders it, and the
 * top block is the builder's own details, not the app's name.
 */
export default function InvoiceDocument({ invoice, business, jobName, fixedWidth = false, title: titleProp, gstNote }: Props) {
  const totals = invoiceTotals(invoice);
  const lines: AnyRecord[] = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const title = titleProp || (totals.hasGst ? 'Tax invoice' : 'Invoice');
  const status = String(invoice.status || '').toLowerCase();
  const bank = [invoice.bsb, invoice.accountName, invoice.accountNumber].some((v) => String(v || '').trim());
  const project = String(invoice.projectName || '').trim();
  const showProject = project && project !== (jobName || '');

  return (
    <div
      className="invoice-document bg-white text-ink"
      style={{
        fontFamily: "'Manrope', system-ui, -apple-system, sans-serif",
        width: fixedWidth ? 794 : '100%',
        maxWidth: 794,
        padding: fixedWidth ? '56px 60px' : undefined,
        boxSizing: 'border-box',
      }}
    >
      <div className={fixedWidth ? '' : 'p-6 sm:p-10'}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[20px] font-extrabold tracking-tight leading-tight">{business.name}</div>
            {business.abn ? <div className="text-[12.5px] text-slate-600 mt-1">ABN {business.abn}</div> : null}
            {business.addressLines.map((line) => (
              <div key={line} className="text-[12.5px] text-slate-600">{line}</div>
            ))}
            {business.mobile || business.email ? (
              <div className="text-[12.5px] text-slate-600 mt-1">
                {[business.mobile, business.email].filter(Boolean).join(' · ')}
              </div>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-slate-400">{title}</div>
            <div className="tabular text-[26px] font-extrabold tracking-tight leading-tight mt-0.5">
              {invoice.invoiceNumber || 'Draft'}
            </div>
            <div className="text-[12.5px] text-slate-600 mt-2">
              <div>Issued {day(invoice.invoiceDate)}</div>
              <div>Due {day(invoice.dueDate)}</div>
            </div>
            {status === 'paid' ? (
              <div className="inline-block mt-2 text-[11px] font-bold text-pos bg-pos-tint px-2 py-0.5 rounded-full">Paid</div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-9 pt-6 border-t border-hairline">
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-1.5">Bill to</div>
            <div className="text-[14px] font-bold">{invoice.clientName || '—'}</div>
            {invoice.clientCompany ? <div className="text-[12.5px] text-slate-600">{invoice.clientCompany}</div> : null}
            {invoice.clientABN ? <div className="text-[12.5px] text-slate-600">ABN {invoice.clientABN}</div> : null}
            {invoice.clientAddress ? <div className="text-[12.5px] text-slate-600 whitespace-pre-line mt-1">{invoice.clientAddress}</div> : null}
            {invoice.clientEmail || invoice.clientPhone ? (
              <div className="text-[12.5px] text-slate-600 mt-1">
                {[invoice.clientEmail, invoice.clientPhone].filter(Boolean).join(' · ')}
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-1.5">Job</div>
            <div className="text-[14px] font-bold">{jobName || project || '—'}</div>
            {showProject ? <div className="text-[12.5px] text-slate-600">{project}</div> : null}
            {invoice.projectReference ? <div className="text-[12.5px] text-slate-600">Ref {invoice.projectReference}</div> : null}
          </div>
        </div>

        <table className="w-full mt-8 border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-bold tracking-[0.08em] uppercase text-slate-400 border-b-2 border-ink">
              <th className="py-2 pr-3 font-bold">Description</th>
              <th className="py-2 px-3 font-bold text-right w-[64px]">Qty</th>
              <th className="py-2 px-3 font-bold text-right w-[110px]">Unit</th>
              <th className="py-2 pl-3 font-bold text-right w-[120px]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-slate-400">No line items</td></tr>
            ) : lines.map((item, index) => (
              <tr key={item.id ?? index} className="border-b border-hairline align-top">
                <td className="py-2.5 pr-3">{item.description || '—'}</td>
                <td className="py-2.5 px-3 text-right tabular">{item.quantity ?? 0}</td>
                <td className="py-2.5 px-3 text-right tabular">{formatCents(safeParseToCents(item.unitCost))}</td>
                <td className="py-2.5 pl-3 text-right tabular font-semibold">{formatCents(totals.lineTotals[index])}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-[260px] text-[13px]">
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600">Subtotal</span>
              <span className="tabular">{formatCents(totals.subtotal)}</span>
            </div>
            {totals.hasGst ? (
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">GST 10%</span>
                <span className="tabular">{formatCents(totals.gst)}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-baseline py-2 mt-1 border-t-2 border-ink">
              <span className="font-extrabold">Total {status === 'paid' ? 'paid' : 'due'}</span>
              <span className="tabular text-[18px] font-extrabold">{formatCents(totals.total)}</span>
            </div>
            {!totals.hasGst ? <div className="text-[11px] text-slate-400 text-right">{gstNote || 'No GST charged'}</div> : null}
          </div>
        </div>

        {bank || invoice.paymentInstructions ? (
          <div className="mt-8 rounded-[10px] border border-hairline bg-[#F7F8FA] p-4 text-[12.5px]">
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-2">How to pay</div>
            {bank ? (
              <div className="grid grid-cols-3 gap-3">
                <div><div className="text-slate-400">Account name</div><div className="font-semibold">{invoice.accountName || '—'}</div></div>
                <div><div className="text-slate-400">BSB</div><div className="font-semibold tabular">{invoice.bsb || '—'}</div></div>
                <div><div className="text-slate-400">Account number</div><div className="font-semibold tabular">{invoice.accountNumber || '—'}</div></div>
              </div>
            ) : null}
            {invoice.paymentInstructions ? (
              <p className={`text-slate-600 whitespace-pre-line ${bank ? 'mt-3' : ''}`}>{invoice.paymentInstructions}</p>
            ) : null}
          </div>
        ) : null}

        {invoice.notes ? (
          <div className="mt-6 text-[12.5px]">
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-1">Notes</div>
            <p className="text-slate-600 whitespace-pre-line">{invoice.notes}</p>
          </div>
        ) : null}

        <div className="mt-10 pt-4 border-t border-hairline text-[11.5px] text-slate-400 flex justify-between">
          <span>Thank you.</span>
          <span>{business.name}</span>
        </div>
      </div>
    </div>
  );
}
