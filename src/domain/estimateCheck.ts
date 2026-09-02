import { formatCents } from '../money';

export type EstimateCheckSection = {
  name: string;
  code?: string;
  amountCents: number;
  tradeName: string;
  lines?: Array<{ description: string; totalCents: number }>;
};

export type EstimateCheckPayload = {
  fileName: string;
  headerRow: string[];
  fileTotals: Array<{ label: string; amountCents: number }>;
  layoutTotalCents: number;
  addGst: boolean;
  planTotalCents: number;
  sections: EstimateCheckSection[];
  sampleRows: string[][];
};

export type EstimateCheckResult = {
  ok: boolean;
  summary: string;
  warnings: string[];
};

const MAX_SECTIONS = 80;
const MAX_LINES = 4;
const MAX_ROWS = 30;
const MAX_CELLS = 8;
const MAX_CELL = 80;

function clip(value: unknown, max = MAX_CELL): string {
  return String(value || '').trim().slice(0, max);
}

export function buildEstimateCheckPayload(input: {
  fileName: string;
  headerRow: string[];
  rows: string[][];
  headerRowIndex: number;
  grandTotals: Array<{ label: string; amountCents: number }>;
  layoutTotalCents: number;
  addGst: boolean;
  planTotalCents: number;
  sections: EstimateCheckSection[];
}): EstimateCheckPayload {
  return {
    fileName: clip(input.fileName, 120),
    headerRow: (input.headerRow || []).slice(0, MAX_CELLS).map((cell) => clip(cell)),
    fileTotals: (input.grandTotals || []).slice(0, 12).map((entry) => ({
      label: clip(entry.label, 80),
      amountCents: Math.max(0, Math.round(Number(entry.amountCents) || 0)),
    })),
    layoutTotalCents: Math.max(0, Math.round(Number(input.layoutTotalCents) || 0)),
    addGst: Boolean(input.addGst),
    planTotalCents: Math.max(0, Math.round(Number(input.planTotalCents) || 0)),
    sections: (input.sections || []).slice(0, MAX_SECTIONS).map((section) => ({
      name: clip(section.name, 120),
      code: section.code ? clip(section.code, 40) : undefined,
      amountCents: Math.max(0, Math.round(Number(section.amountCents) || 0)),
      tradeName: clip(section.tradeName, 80),
      lines: (section.lines || []).slice(0, MAX_LINES).map((line) => ({
        description: clip(line.description, 120),
        totalCents: Math.round(Number(line.totalCents) || 0),
      })),
    })),
    sampleRows: (input.rows || [])
      .slice(Math.max(0, input.headerRowIndex), input.headerRowIndex + MAX_ROWS)
      .map((row) => (row || []).slice(0, MAX_CELLS).map((cell) => clip(cell))),
  };
}

export function parseEstimateCheckContent(content: unknown): EstimateCheckResult {
  const raw = String(content || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('The AI check did not return a usable result.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('The AI check did not return a usable result.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The AI check did not return a usable result.');
  }
  const data = parsed as Record<string, unknown>;
  const warnings = Array.isArray(data.warnings)
    ? data.warnings.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
    : [];
  return {
    ok: data.ok === true && warnings.length === 0,
    summary: clip(data.summary, 280) || (warnings.length ? 'Have a look at these before saving.' : 'Looks right.'),
    warnings,
  };
}

export function describeEstimateCheckTotals(payload: EstimateCheckPayload): string {
  const file = payload.fileTotals
    .map((entry) => `${entry.label} ${formatCents(entry.amountCents)}`)
    .join(' · ');
  const gst = payload.addGst ? 'Add GST is on.' : 'Add GST is off.';
  return `Sections ${formatCents(payload.layoutTotalCents)}. Plan ${formatCents(payload.planTotalCents)}. ${gst}${file ? ` File says ${file}.` : ''}`;
}
