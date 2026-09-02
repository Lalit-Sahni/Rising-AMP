/**
 * A Bill of Quantities is not a flat table. It is section headings, repeated
 * column headers, line items, per-section total rows and a grand-total block,
 * all sharing the same columns. Classify each row by its shape before grouping.
 *
 * Without this, `groupImportRows` falls back to `row.section || row.description`,
 * every line item becomes its own section, and the total rows are counted as
 * money. On the Kelly St estimate that produced 33 sections and $900,739.99
 * against a real $321,916.29.
 */
import { cents, parseToCents, type Cents } from '../money';
import type { ColumnMap, ImportColumn, ImportRow } from './costPlanImport';

const HEADER_WORDS: Record<string, RegExp> = {
  code: /^(item\s*)?code$|^ref$|^no\.?$|^item$/,
  description: /desc|particular|item name|narrative/,
  qty: /^qty$|quantity/,
  unit: /^unit$|^uom$/,
  unitPrice: /^price$|unit.?price|^rate$/,
  amount: /^total$|^amount$|^extended$|^line total$/,
};

const TOTAL_LABEL = /^(sub[- ]?)?total$|^sum$/i;
/**
 * A working estimate tracks its own actuals beside the estimate: "Actual Price",
 * "Actual Total", "Paid", "Variance". Those columns are money-shaped and sit to
 * the RIGHT of the estimate columns, so "rightmost money column wins" hands the
 * amount role to a column that is all zeros until the job is spent. The whole
 * file then reads as $0.00. A column whose header says actual is never the
 * estimate.
 */
const ACTUALS_HEADER = /actual|\bpaid\b|\bspent\b|variance|committed|forecast|invoiced|to\s*date|remaining/;
/**
 * A section code is a whole number, or a whole number with only zeros after the
 * point: 1, 2, 15, 1.000, 2.00. A line code has a real decimal part: 1.001,
 * 1.02, 3.004. This is the only signal that survives a file whose line items
 * have no price yet, which is normal in a working estimate.
 */
const SECTION_CODE = /^\d+(\.0+)?$/;
/** A line code has a real decimal part: 1.001, 4.0021, 12.004. */
const LINE_CODE = /^\d+\.\d+$/;
const GRAND_LABEL = /gst|sum including|unit rate|construction cost|grand total|project total/i;

/** A stated section total wins over the sum of its lines within this much drift. */
export const SECTION_TOTAL_TOLERANCE_CENTS = 100;

function norm(value: unknown): string {
  return String(value ?? '').trim();
}

function isBlank(value: unknown): boolean {
  const raw = norm(value);
  return raw === '' || raw === '-' || raw === '—' || raw === '$' || raw === '$ -';
}

function money(value: unknown): number {
  if (isBlank(value)) return 0;
  try {
    return parseToCents(value);
  } catch {
    return 0;
  }
}

/**
 * Score every row against the known header words and take the best. A BOQ puts
 * its title, built area and date above the real header, so row 0 is usually junk.
 */
export function findHeaderRowIndex(rows: string[][], limit = 40): number {
  let bestIndex = 0;
  let bestScore = 0;
  rows.slice(0, limit).forEach((row, index) => {
    let score = 0;
    let hasDescription = false;
    let hasMoney = false;
    row.forEach((raw) => {
      const value = norm(raw).toLowerCase();
      if (!value) return;
      Object.entries(HEADER_WORDS).forEach(([role, pattern]) => {
        if (!pattern.test(value)) return;
        score += 1;
        if (role === 'description') hasDescription = true;
        if (role === 'amount' || role === 'unitPrice') hasMoney = true;
      });
    });
    if (hasDescription && hasMoney && score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/**
 * `guessColumnMap` matches /amount|total|cost|price/ for the amount role, so a
 * "Price" column is claimed as the line total and the unit rate is never mapped.
 * Anchor the patterns and let the rightmost money column win the amount role.
 */
function columnHasFigures(rows: string[][], index: number): boolean {
  return rows.some((row) => {
    const raw = row ? row[index] : '';
    if (isBlank(raw)) return false;
    return money(raw) > 0;
  });
}

export function guessColumnMapStrict(
  headers: string[] = [],
  dataRows: string[][] = [],
): ColumnMap {
  const map: ColumnMap = {};
  const moneyish: number[] = [];
  const actuals = new Set<number>();
  headers.forEach((raw, index) => {
    const value = norm(raw).toLowerCase();
    map[index] = 'ignore';
    if (!value) return;
    const role = (Object.keys(HEADER_WORDS) as ImportColumn[]).find(
      (key) => HEADER_WORDS[key].test(value),
    );
    if (role) map[index] = role;
    if (/price|total|amount|rate|cost/.test(value)) {
      moneyish.push(index);
      if (ACTUALS_HEADER.test(value)) actuals.add(index);
    }
  });

  // The estimate's own actuals columns are not the estimate. Only fall back to
  // them when the file has nothing else money-shaped.
  let candidates = moneyish.filter((index) => !actuals.has(index));
  if (candidates.length === 0) candidates = moneyish;

  // With the sheet in hand, a column holding no figures at all cannot be the
  // line total however far right it sits. This catches an actuals column whose
  // header does not say "actual".
  if (dataRows.length > 0 && candidates.length > 1) {
    const populated = candidates.filter((index) => columnHasFigures(dataRows, index));
    if (populated.length > 0) candidates = populated;
  }

  // Anything money-shaped that lost is tracking, not estimate. Reading it would
  // double-count or zero the plan, so it is ignored rather than left mapped.
  moneyish.forEach((index) => {
    if (!candidates.includes(index)) map[index] = 'ignore';
  });

  if (candidates.length > 1) {
    const last = candidates[candidates.length - 1];
    candidates.forEach((index) => {
      map[index] = index === last ? 'amount' : 'unitPrice';
    });
  }
  return map;
}

export type BoqRowKind = 'header' | 'section' | 'line' | 'sectionTotal' | 'grandTotal' | 'noise';

export type BoqSection = {
  key: string;
  code: string;
  name: string;
  amountCents: Cents;
  /** The section's own Total row, when the file states one. Null when it does not. */
  statedTotalCents: Cents | null;
  rows: ImportRow[];
  /** Source codes this section shares with another. Labels, never identifiers. */
  duplicateCodes: string[];
};

export type BoqGrandTotal = { label: string; amountCents: Cents };

export type BoqLayout = {
  sections: BoqSection[];
  /** Every labelled total row under the last section, in file order. */
  grandTotals: BoqGrandTotal[];
  warnings: string[];
};

function indexesFor(map: ColumnMap): Partial<Record<ImportColumn, number>> {
  const indexes: Partial<Record<ImportColumn, number>> = {};
  Object.entries(map).forEach(([index, role]) => {
    if (role !== 'ignore') indexes[role as ImportColumn] = Number(index);
  });
  return indexes;
}

function at(row: string[], index: number | undefined): string {
  if (index == null) return '';
  return norm(row[index]);
}

/**
 * A BOQ reprints its column header before every section, and those reprints are
 * rarely byte-identical (a trailing "Comments" column drops off, a stray space
 * creeps in). Match on how many cells read as header words instead. This has to
 * run before the total checks, because the header itself contains "Total".
 */
export function looksLikeHeaderRow(row: string[], headerRow: string[]): boolean {
  const same = row.map((v) => norm(v).toLowerCase()).join('|')
    === headerRow.map((v) => norm(v).toLowerCase()).join('|');
  if (same) return true;
  let hits = 0;
  let hasDescription = false;
  row.forEach((raw) => {
    const value = norm(raw).toLowerCase();
    if (!value) return;
    Object.entries(HEADER_WORDS).forEach(([role, pattern]) => {
      if (!pattern.test(value)) return;
      hits += 1;
      if (role === 'description') hasDescription = true;
    });
  });
  return hits >= 3 && hasDescription;
}

export type BoqProfile = {
  /** The file numbers its sections, so code shape decides section vs line. */
  usesSectionCodes: boolean;
};

/**
 * Does this file number its sections? True when at least one row carries a
 * section-shaped code and at least one other carries a line-shaped code.
 */
export function profileBoq(rows: string[][], map: ColumnMap, headerRowIndex: number): BoqProfile {
  const indexes = indexesFor(map);
  if (indexes.code == null) return { usesSectionCodes: false };
  let sectionShaped = 0;
  let lineShaped = 0;
  rows.forEach((row, index) => {
    if (index === headerRowIndex) return;
    const code = at(row, indexes.code);
    if (!code) return;
    if (SECTION_CODE.test(code)) sectionShaped += 1;
    else if (/^\d+\.\d+$/.test(code)) lineShaped += 1;
  });
  return { usesSectionCodes: sectionShaped > 0 && lineShaped > 0 };
}

export function classifyBoqRow(
  row: string[],
  map: ColumnMap,
  headerRow: string[],
  profile: BoqProfile = { usesSectionCodes: false },
): BoqRowKind {
  const indexes = indexesFor(map);
  const code = at(row, indexes.code);
  const description = at(row, indexes.description);
  const qty = at(row, indexes.qty);
  const unit = at(row, indexes.unit);
  const amount = at(row, indexes.amount);
  const unitPrice = at(row, indexes.unitPrice);

  const everything = row.map(norm).filter(Boolean);
  if (everything.length === 0) return 'noise';

  if (looksLikeHeaderRow(row, headerRow)) return 'header';

  /**
   * A row carrying a line-shaped code is a line item, whatever words sit in its
   * comment cells. The label tests below read EVERY cell in the row, so a note
   * against a real item ("$39,500 Plus GST", "sum including sink") matched
   * GRAND_LABEL and turned that item into a phantom grand total. Its money then
   * left the section silently. On the 167sqm estimate that cost the kitchen line
   * $14,660, and it only survived because the section stated its own total.
   */
  if (profile.usesSectionCodes && code && !SECTION_CODE.test(code) && LINE_CODE.test(code)) {
    return 'line';
  }

  const anyMoney = !isBlank(amount) || !isBlank(unitPrice);
  if (everything.some((value) => GRAND_LABEL.test(value))) return 'grandTotal';
  if (everything.some((value) => TOTAL_LABEL.test(value))) return 'sectionTotal';
  if (/\btotal\b/i.test(description) && isBlank(qty) && isBlank(unit)) return 'sectionTotal';

  if (profile.usesSectionCodes && code) {
    // The code settles it. An unpriced line item is still a line.
    return SECTION_CODE.test(code) ? 'section' : 'line';
  }

  // Nothing numbered to lean on: a heading names something and carries no
  // money, quantity or unit.
  if (description && !anyMoney && isBlank(qty) && isBlank(unit)) return 'section';
  if (!description && code && !anyMoney) return 'section';

  if (description || code || !isBlank(amount)) return 'line';
  return 'noise';
}

export function readBoqLayout(
  rows: string[][],
  map: ColumnMap,
  headerRowIndex: number,
): BoqLayout {
  const indexes = indexesFor(map);
  const headerRow = rows[headerRowIndex] || [];
  const profile = profileBoq(rows, map, headerRowIndex);
  const sections: BoqSection[] = [];
  const warnings: string[] = [];
  const grandTotals: BoqGrandTotal[] = [];
  let current: BoqSection | null = null;
  let orphanLines = 0;

  const push = () => {
    if (current) sections.push(current);
    current = null;
  };

  rows.forEach((row, index) => {
    const kind = classifyBoqRow(row, map, headerRow, profile);
    const code = at(row, indexes.code);
    const description = at(row, indexes.description);

    if (kind === 'header' || kind === 'noise') return;
    // A BOQ prints its first section heading ABOVE the column header row, and
    // its title, built area and date above that. Before the header, only a
    // heading is meaningful; anything money-shaped up there is cover material.
    if (index <= headerRowIndex && kind !== 'section') return;

    if (kind === 'grandTotal') {
      const label = row.map(norm).find((value) => value && GRAND_LABEL.test(value)) || 'Total';
      grandTotals.push({ label, amountCents: cents(money(at(row, indexes.amount))) });
      return;
    }

    if (kind === 'section') {
      push();
      const name = description || code || 'Untitled section';
      current = {
        key: `${code}|${name}`.toLowerCase(),
        code,
        name,
        amountCents: cents(0),
        statedTotalCents: null,
        rows: [],
        duplicateCodes: [],
      };
      return;
    }

    if (kind === 'sectionTotal') {
      if (current) current.statedTotalCents = cents(money(at(row, indexes.amount)));
      push();
      return;
    }

    if (!current) {
      orphanLines += 1;
      current = {
        key: 'untitled',
        code: '',
        name: 'Untitled section',
        amountCents: cents(0),
        statedTotalCents: null,
        rows: [],
        duplicateCodes: [],
      };
    }
    const qtyRaw = at(row, indexes.qty).replace(/,/g, '');
    const qty = qtyRaw === '' ? null : Number(qtyRaw);
    const line: ImportRow = {
      code,
      description,
      section: current.name,
      qty: qty != null && Number.isFinite(qty) ? qty : null,
      unit: at(row, indexes.unit),
      unitPriceCents: isBlank(at(row, indexes.unitPrice)) ? null : money(at(row, indexes.unitPrice)),
      totalCents: money(at(row, indexes.amount)),
    };
    current.rows.push(line);
    current.amountCents = cents(current.amountCents + Math.max(0, line.totalCents));
  });
  push();

  const kept = sections
    .filter((section) => section.rows.length > 0 || section.amountCents > 0)
    .map((section) => {
      if (section.statedTotalCents == null || section.statedTotalCents <= 0) return section;
      const drift = Math.abs(section.statedTotalCents - section.amountCents);
      if (drift === 0) return section;
      if (drift > SECTION_TOTAL_TOLERANCE_CENTS) {
        warnings.push(
          `${section.name}: the lines add to $${(section.amountCents / 100).toFixed(2)} but the file's own total says $${(section.statedTotalCents / 100).toFixed(2)}. Using the file's total.`,
        );
      }
      // The estimator's own total row is the number they signed off. Prefer it
      // even when the line sum is wildly different, which usually means the
      // total row was also counted as a line.
      return { ...section, amountCents: section.statedTotalCents };
    });

  const seen = new Map<string, string[]>();
  kept.forEach((section) => {
    if (!section.code) return;
    const owners = seen.get(section.code) || [];
    owners.push(section.name);
    seen.set(section.code, owners);
  });
  const duplicated: string[] = [];
  seen.forEach((owners, code) => {
    if (owners.length > 1) {
      duplicated.push(code);
      warnings.push(`${code} is used for ${owners.join(' and ')}. Codes are labels, not identifiers.`);
    }
  });
  kept.forEach((section) => {
    section.duplicateCodes = duplicated.includes(section.code) ? [section.code] : [];
  });

  if (indexes.amount == null) {
    warnings.push('No column is mapped as the line total, so every figure reads as zero. Check the header row.');
  }

  if (orphanLines > 0) {
    warnings.push(`${orphanLines} line${orphanLines === 1 ? '' : 's'} appeared before any section heading.`);
  }

  return { sections: kept, grandTotals, warnings };
}

/**
 * Section headings are trade names written by a human, so they are misspelled,
 * abbreviated and combined. A literal substring match against the trade name
 * gets about a third of them. A hand-kept synonym table gets all of them, with
 * no model, no key, no network call and no latency. When a word is missed, add
 * the word.
 */
const TRADE_SYNONYMS: Record<string, string[]> = {
  'site-works': ['site work', 'preliminar', 'site establish', 'planning', 'approval', 'council', 'survey'],
  demolition: ['demolition', 'demo', 'strip out'],
  concreting: ['concret', 'slab', 'piering', 'footing', 'excavat', 'benching'],
  'structural-steel': ['steel', 'beam', 'column', 'lintel'],
  plumbing: ['plumb', 'drainage', 'stormwater', 'hot water', 'tank', 'sanitary'],
  carpentry: ['carpent', 'frame', 'framing', 'timber', 'joist', 'truss'],
  brickwork: ['brick', 'masonry', 'block', 'hebel', 'cladding', 'veneer'],
  roofing: ['roof', 'eave', 'gutter', 'fascia', 'colorbond'],
  'windows-doors': ['window', 'door', 'glazing', 'architrave', 'skirting', 'frames'],
  electrical: ['electric', 'light', 'power', 'data'],
  waterproofing: ['waterproof', 'silicon', 'membrane', 'tanking'],
  plastering: ['plaster', 'gyprock', 'render', 'insulation', 'insualtion', 'cornice', 'bulkhead', 'lining'],
  'tiling-flooring': ['tiling', 'tile', 'floor cover', 'flooring', 'carpet', 'screed', 'vinyl'],
  painting: ['paint'],
  'kitchen-joinery': ['kitchen', 'joinery', 'cabinet', 'vanit', 'wardrobe', 'robe', 'laundry', 'appliance', 'benchtop'],
  hvac: ['air-condition', 'air condition', 'aircon', 'hvac', 'heating', 'ventilat', 'split system', 'ducted'],
  scaffolding: ['scaffold'],
  'external-works': ['external', 'driveway', 'fence', 'clothesline', 'mailbox', 'crossover', 'path'],
  landscaping: ['landscap', 'turf', 'garden', 'pool'],
  other: ['miscellaneous', 'miscelleneous', 'general requirement', 'sundries', 'allowance', 'provisional', 'stairs', 'balustrade', 'shower screen', 'fixtures', 'accessories'],
};

/** The longest matching word wins, so "garage door" beats a bare "door". */
export function matchTradeForSection(name: string, allowedIds: string[] = []): string | null {
  const haystack = norm(name).toLowerCase();
  if (!haystack) return null;
  const allowed = new Set(allowedIds.filter(Boolean));
  let best: string | null = null;
  let bestLength = 0;
  Object.entries(TRADE_SYNONYMS).forEach(([id, words]) => {
    if (allowed.size > 0 && !allowed.has(id)) return;
    words.forEach((word) => {
      if (haystack.includes(word) && word.length > bestLength) {
        best = id;
        bestLength = word.length;
      }
    });
  });
  return best;
}

/** How far a total may sit from the file's own figure and still be believed. */
export const FILE_TOTAL_TOLERANCE_CENTS = 100;

/**
 * Tick Add GST when the file states both the construction cost and that same
 * figure with 10% on top. The sections are cost; the plan stores GST inclusive.
 */
export function suggestAddGst(
  layoutTotalCents: number,
  grandTotals: BoqGrandTotal[] = [],
): boolean {
  if (layoutTotalCents <= 0) return false;
  const withGst = Math.round((layoutTotalCents * 11) / 10);
  if (withGst === layoutTotalCents) return false;
  const gstOnly = withGst - layoutTotalCents;
  const matchesInclusive = grandTotals.some(
    (entry) => Math.abs(entry.amountCents - withGst) <= FILE_TOTAL_TOLERANCE_CENTS,
  );
  const matchesLayout = grandTotals.some(
    (entry) => Math.abs(entry.amountCents - layoutTotalCents) <= FILE_TOTAL_TOLERANCE_CENTS,
  );
  if (matchesInclusive && matchesLayout) return true;
  return grandTotals.some((entry) => {
    const label = String(entry.label || '').toLowerCase();
    return /gst|tax/.test(label)
      && Math.abs(entry.amountCents - gstOnly) <= FILE_TOTAL_TOLERANCE_CENTS;
  });
}

export type FileTotalCheck = {
  /** The file states a figure that the mapped sections add up to. */
  corroborated: boolean;
  /** The label of the figure that matched, when one did. */
  matchedLabel: string | null;
  /** The closest stated figure, for the message when nothing matched. */
  nearest: BoqGrandTotal | null;
  /** How many usable figures the file states. Zero means there is nothing to check against. */
  statedCount: number;
  totalCents: number;
};

/**
 * The parser meets file shapes nobody has seen. The guard against that is not a
 * cleverer parser, it is arithmetic: a BOQ states its own construction cost, so
 * a correct read adds up to a number already printed in the file. If nothing in
 * the file corroborates the total, the read is not trustworthy and the plan
 * must not be saved from it.
 *
 * The final price is deliberately not the thing being matched. A file's final
 * price adds GST, or a builder's margin, or both, on top of the construction
 * cost. The sections are cost.
 */
export function checkAgainstFileTotals(
  totalCents: number,
  grandTotals: BoqGrandTotal[],
): FileTotalCheck {
  // Only positive figures are evidence. When no amount column is mapped every
  // cell reads as zero, and a zero total "matching" a zero stated figure would
  // wave through the exact failure this check exists to catch.
  const stated = grandTotals.filter((entry) => entry.amountCents > 0);
  if (stated.length === 0 || totalCents <= 0) {
    return {
      corroborated: false,
      matchedLabel: null,
      nearest: stated[0] || null,
      statedCount: stated.length,
      totalCents,
    };
  }
  let nearest = stated[0];
  stated.forEach((entry) => {
    if (Math.abs(entry.amountCents - totalCents) < Math.abs(nearest.amountCents - totalCents)) {
      nearest = entry;
    }
  });
  const corroborated = Math.abs(nearest.amountCents - totalCents) <= FILE_TOTAL_TOLERANCE_CENTS;
  return {
    corroborated,
    matchedLabel: corroborated ? nearest.label : null,
    nearest,
    statedCount: stated.length,
    totalCents,
  };
}

/** True when any of the candidate totals is a figure the file itself states. */
export function bestFileTotalCheck(
  totals: number[],
  grandTotals: BoqGrandTotal[],
): FileTotalCheck {
  const candidates = [...new Set(
    totals
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => Math.round(value)),
  )];
  if (candidates.length === 0) return checkAgainstFileTotals(0, grandTotals);
  let best = checkAgainstFileTotals(candidates[0], grandTotals);
  candidates.slice(1).forEach((total) => {
    const check = checkAgainstFileTotals(total, grandTotals);
    if (!best.corroborated && check.corroborated) {
      best = check;
      return;
    }
    if (best.corroborated) return;
    const bestGap = Math.abs((best.nearest?.amountCents || 0) - best.totalCents);
    const gap = Math.abs((check.nearest?.amountCents || 0) - check.totalCents);
    if (gap < bestGap) best = check;
  });
  return best;
}
