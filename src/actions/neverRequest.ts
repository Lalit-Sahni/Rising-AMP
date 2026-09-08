/**
 * Map a plain-language ask to a NEVER action name. Not a model.
 * Tests and refusal evals only. Do not import from App.js or first paint.
 */
import { isNeverAction, type NeverActionName } from './core';

export function neverActionMessage(name: NeverActionName): string {
  switch (name) {
    case 'sendEmail':
      return 'The assistant cannot email a client or send a docket. That leaves the building. You can send it yourself.';
    case 'allocateInvoiceNumber':
      return 'The assistant cannot allocate an invoice number. That consumes a number you cannot hand back.';
    case 'invitePerson':
      return 'The assistant cannot invite anyone onto a job. You can invite them from Jobs.';
    case 'removePerson':
      return 'The assistant cannot remove a person from a job. You can do that from Jobs.';
    case 'archiveJob':
      return 'The assistant cannot archive a job. You can archive it from Jobs.';
    case 'deleteRecord':
      return 'The assistant cannot delete a record. Expenses are voided, not deleted, and only you can do that.';
    case 'changeSetting':
      return 'The assistant cannot change a setting or a rule. You can change it yourself.';
    case 'spendMoney':
      return 'The assistant cannot spend money or pay a supplier.';
    default:
      return 'The assistant cannot do that. It is not reversible in one tap.';
  }
}

const PHRASE_RULES: Array<{ pattern: RegExp; action: NeverActionName }> = [
  { pattern: /\bemail\b.*\binvoice\b|\bsend\b.*\bdocket\b|\bsend\b.*\b(the\s+)?client\b/i, action: 'sendEmail' },
  { pattern: /\ballocate\b.*\binvoice\s+number\b/i, action: 'allocateInvoiceNumber' },
  { pattern: /\binvite\b/i, action: 'invitePerson' },
  { pattern: /\bremove\b.*\bfrom\s+the\s+job\b|\bremove\b\s+\w+/i, action: 'removePerson' },
  { pattern: /\barchive\b.*\bjob\b/i, action: 'archiveJob' },
  { pattern: /\bdelete\b/i, action: 'deleteRecord' },
  { pattern: /\bchange\b.*\b(setting|gst)\b|\bcost\s+plan\s+gst\b/i, action: 'changeSetting' },
  { pattern: /\bpay\b.*\bsupplier\b|\bspend\s+money\b/i, action: 'spendMoney' },
];

export function mapNeverRequest(phrase: string): NeverActionName | null {
  const text = String(phrase || '').trim();
  if (!text) return null;
  if (isNeverAction(text)) return text;
  for (const rule of PHRASE_RULES) {
    if (rule.pattern.test(text)) return rule.action;
  }
  return null;
}
