export const QUOTE_FILE_MAX = 10;

export type QuoteFileFields = {
  id?: string;
  party?: string;
  status?: string;
  fileId?: string | null;
  fileIds?: string[] | null;
};

function cleanFileId(value: unknown): string {
  const id = String(value || '').trim();
  if (!id || id.length > 80) return '';
  return id;
}

export function uniqueQuoteFileIds(ids: unknown[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  (ids || []).forEach((value) => {
    const id = cleanFileId(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

/** Prefer the list; keep a leftover single `fileId` so old rows still count. */
export function quoteFileIds(quote: QuoteFileFields | null | undefined): string[] {
  const listed = uniqueQuoteFileIds(quote?.fileIds);
  const single = cleanFileId(quote?.fileId);
  if (!single) return listed.slice(0, QUOTE_FILE_MAX);
  if (listed.includes(single)) return listed.slice(0, QUOTE_FILE_MAX);
  return [single, ...listed].slice(0, QUOTE_FILE_MAX);
}

export function quoteFilePayload(ids: unknown[] | null | undefined): {
  fileId: string | null;
  fileIds: string[];
} {
  const unique = uniqueQuoteFileIds(ids).slice(0, QUOTE_FILE_MAX);
  return {
    fileId: unique[0] || null,
    fileIds: unique,
  };
}

export function addQuoteFileIds(
  current: string[],
  incoming: unknown[],
): { ok: true; ids: string[] } | { ok: false; error: string } {
  const next = uniqueQuoteFileIds([...current, ...incoming]);
  if (next.length > QUOTE_FILE_MAX) {
    return { ok: false, error: `A quote can hold ${QUOTE_FILE_MAX} files.` };
  }
  return { ok: true, ids: next };
}

export function removeQuoteFileId(current: string[], fileId: string): string[] {
  const drop = cleanFileId(fileId);
  return uniqueQuoteFileIds(current).filter((id) => id !== drop);
}

export function liveQuoteFileTargets(quotes: QuoteFileFields[] = []): QuoteFileFields[] {
  return (quotes || []).filter((quote) => quote && quote.id && quote.status !== 'void');
}

export function quoteForFileId(
  quotes: QuoteFileFields[] | null | undefined,
  fileId: string | null | undefined,
): QuoteFileFields | null {
  const id = cleanFileId(fileId);
  if (!id) return null;
  return liveQuoteFileTargets(quotes || []).find((quote) => quoteFileIds(quote).includes(id)) || null;
}
