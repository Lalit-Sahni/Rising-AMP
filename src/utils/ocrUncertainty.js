/**
 * Honest OCR uncertainty — only from missing/invalid extracted fields
 * or warnings the scanner already produced. No invented confidence scores.
 */

function isValidDate(value) {
  if (value == null || value === '') return false;
  const date = value instanceof Date ? value : new Date(value);
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function warningText(ocrResult) {
  const fromResult = Array.isArray(ocrResult && ocrResult.warnings) ? ocrResult.warnings : [];
  const fromMeta = ocrResult && ocrResult.extractedData && ocrResult.extractedData.warnings;
  const extra = Array.isArray(fromMeta) ? fromMeta : [];
  return [...fromResult, ...extra].join(' ').toLowerCase();
}

export function detectUncertainFields(ocrResult) {
  const flags = {};
  if (!ocrResult) return flags;

  const extracted = ocrResult.extractedData || {};
  const warnings = warningText(ocrResult);
  const category = ocrResult.category || extracted.category;

  const date = extracted.date || (ocrResult.formData && ocrResult.formData.date);
  if (!isValidDate(date) || /date/.test(warnings)) {
    flags.date = true;
    flags.startDate = true;
    flags.endDate = true;
  }

  const amount = extracted.totalAmount;
  const amountMissing = amount == null || amount === '' || Number(amount) <= 0;
  if (amountMissing || /amount|total/.test(warnings)) {
    flags.amount = true;
    flags.cost = true;
    flags.unitCost = true;
    flags.totalPrice = true;
    flags.rate = true;
  }

  if (category === 'labour') {
    flags.hours = true;
  }

  return flags;
}

export function fieldIsUncertain(uncertainFields, fieldName) {
  if (!uncertainFields || !fieldName) return false;
  return Boolean(uncertainFields[fieldName]);
}
