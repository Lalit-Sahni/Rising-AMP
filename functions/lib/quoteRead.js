'use strict';

exports.QUOTE_READ_PROMPT = `You are reading a construction quote, tender, or supplier price for an Australian builder.

Extract ONLY what is on the document. Do not invent a company, date, or total. If a field is not on the page, use null.

Return ONLY JSON:
{
  "party": "Who issued the quote (business name)",
  "receivedDate": "YYYY-MM-DD or null",
  "amount": 12345.67,
  "amountHigh": null,
  "gstMode": "inclusive" | "exclusive" | null,
  "tradeId": "one of the provided trade ids, or null",
  "trade": "plain trade name if you cannot pick an id",
  "quoteNumber": "quote/tender number or null",
  "note": "one short line of what the quote is for, or null",
  "warnings": ["plain language, max 6"]
}

Rules:
- amount is the GST-aware total the builder would pay if they accept this quote. Use a number, not a string.
- amountHigh only if the document states a range or "up to".
- gstMode is inclusive when the total already includes GST, exclusive when GST is on top.
- tradeId must be copied exactly from the provided list, or null.
- warnings only for things you could not read, not style.
`;

function clip(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max || 80);
}

function asGstMode(value) {
  return value === 'exclusive' || value === 'inclusive' ? value : null;
}

function asAmount(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

exports.parseQuoteReadContent = function parseQuoteReadContent(content, allowedTradeIds) {
  const raw = String(content || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('empty-quote-read');
  }
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (error) {
    throw new Error('empty-quote-read');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('empty-quote-read');
  }
  const allowed = new Set((allowedTradeIds || []).map((id) => String(id)));
  const tradeId = clip(parsed.tradeId, 80);
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.map((item) => clip(item, 240)).filter(Boolean).slice(0, 6)
    : [];
  return {
    party: clip(parsed.party, 120),
    receivedDate: clip(parsed.receivedDate, 32) || null,
    amount: asAmount(parsed.amount),
    amountHigh: asAmount(parsed.amountHigh),
    gstMode: asGstMode(parsed.gstMode),
    tradeId: allowed.has(tradeId) ? tradeId : null,
    trade: clip(parsed.trade, 80) || null,
    quoteNumber: clip(parsed.quoteNumber, 80) || null,
    note: clip(parsed.note, 400) || null,
    warnings,
  };
};

exports.sanitizeQuoteReadInput = function sanitizeQuoteReadInput(data) {
  const source = data && typeof data === 'object' ? data : {};
  const trades = Array.isArray(source.trades) ? source.trades.slice(0, 40) : [];
  return {
    fileName: clip(source.fileName, 120),
    trades: trades.map((trade) => ({
      id: clip(trade && trade.id, 80),
      name: clip(trade && trade.name, 80),
    })).filter((trade) => trade.id && trade.name),
  };
};
