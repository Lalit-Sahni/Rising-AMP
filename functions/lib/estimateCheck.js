'use strict';

exports.ESTIMATE_CHECK_PROMPT = `You are checking a construction bill of quantities after a spreadsheet import.

The app already read the Excel/CSV. You are not parsing a new file. Do not invent line items or change the numbers.

You receive JSON with:
- the file name and a sample of rows
- figures the file itself states
- each heading amount and the trade it was mapped to
- whether 10% GST is being added on top

Look only for real problems:
- a heading mapped to the wrong trade (for example painting under plumbing)
- a GST, margin, or "sum including" row treated as a trade
- Add GST on when the amounts already include GST, or off when the file clearly states an ex-GST construction cost plus GST
- a plan total that does not match the file's construction cost (or that cost plus GST when Add GST is on)
- two different headings mapped onto one trade when they are clearly different trades

Do not warn about missing quotes, missing expenses, or style. Do not warn just because a heading name is slightly different from the trade name.

Return ONLY JSON:
{
  "ok": true,
  "summary": "One short sentence.",
  "warnings": ["Plain language, max 8"]
}

ok must be true only when warnings is empty.`;

function clip(value, max) {
  return String(value || '').trim().slice(0, max || 80);
}

exports.parseEstimateCheckContent = function parseEstimateCheckContent(content) {
  const raw = String(content || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('empty-check');
  }
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (error) {
    throw new Error('empty-check');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('empty-check');
  }
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.map((item) => clip(item, 240)).filter(Boolean).slice(0, 8)
    : [];
  return {
    ok: parsed.ok === true && warnings.length === 0,
    summary: clip(parsed.summary, 280) || (warnings.length ? 'Have a look at these before saving.' : 'Looks right.'),
    warnings,
  };
};

exports.sanitizeEstimateCheckInput = function sanitizeEstimateCheckInput(data) {
  const source = data && typeof data === 'object' ? data : {};
  const sections = Array.isArray(source.sections) ? source.sections.slice(0, 80) : [];
  const sampleRows = Array.isArray(source.sampleRows) ? source.sampleRows.slice(0, 30) : [];
  return {
    fileName: clip(source.fileName, 120),
    headerRow: Array.isArray(source.headerRow)
      ? source.headerRow.slice(0, 8).map((cell) => clip(cell))
      : [],
    fileTotals: Array.isArray(source.fileTotals)
      ? source.fileTotals.slice(0, 12).map((entry) => ({
        label: clip(entry && entry.label, 80),
        amountCents: Math.max(0, Math.round(Number(entry && entry.amountCents) || 0)),
      }))
      : [],
    layoutTotalCents: Math.max(0, Math.round(Number(source.layoutTotalCents) || 0)),
    addGst: Boolean(source.addGst),
    planTotalCents: Math.max(0, Math.round(Number(source.planTotalCents) || 0)),
    sections: sections.map((section) => ({
      name: clip(section && section.name, 120),
      code: section && section.code ? clip(section.code, 40) : undefined,
      amountCents: Math.max(0, Math.round(Number(section && section.amountCents) || 0)),
      tradeName: clip(section && section.tradeName, 80),
      lines: Array.isArray(section && section.lines)
        ? section.lines.slice(0, 4).map((line) => ({
          description: clip(line && line.description, 120),
          totalCents: Math.round(Number(line && line.totalCents) || 0),
        }))
        : [],
    })),
    sampleRows: sampleRows.map((row) => (
      Array.isArray(row) ? row.slice(0, 8).map((cell) => clip(cell)) : []
    )),
  };
};
