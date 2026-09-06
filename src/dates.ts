/**
 * A calendar day is a YYYY-MM-DD string in the user's local timezone.
 * An instant is a Firestore Timestamp (or Date). Mixing them is the
 * off-by-one bug: toISOString() is UTC, so an evening in the US or a
 * morning in Australia can land on the wrong day.
 */
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export const STANDARD_INVOICE_TERMS_DAYS = 30;

export function isYmd(value: unknown): value is string {
  return typeof value === 'string' && YMD.test(value);
}

export function toYmd(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayYmd(now = new Date()): string {
  return toYmd(now);
}

export function ymdToLocalDate(ymd: string): Date | null {
  const match = typeof ymd === 'string' ? ymd.match(YMD) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function addDaysYmd(ymd: string, days: number): string {
  const date = ymdToLocalDate(ymd);
  if (!date) throw new Error('Invalid calendar date');
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

export function defaultDueYmd(issueYmd: string): string {
  return addDaysYmd(issueYmd, STANDARD_INVOICE_TERMS_DAYS);
}

/**
 * Read a stored calendar date. YYYY-MM-DD is local. ISO datetimes and
 * Date objects use local components, never the UTC date part.
 */
export function parseCalendarDate(value: unknown): Date | null {
  if (value == null || value === '' || value === 'Invalid Date') return null;
  if (isYmd(value)) return ymdToLocalDate(value);
  if (typeof value === 'object' && value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && value && typeof (value as { seconds?: number }).seconds === 'number') {
    const date = new Date((value as { seconds: number }).seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const ymd = value.slice(0, 10);
    if (isYmd(ymd) && (value.length === 10 || value[10] === 'T')) {
      return ymdToLocalDate(ymd);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function calendarDateToYmd(value: unknown): string | null {
  if (isYmd(value)) return value;
  const date = parseCalendarDate(value);
  return date ? toYmd(date) : null;
}
