import {
  bestFileTotalCheck,
  checkAgainstFileTotals,
  classifyBoqRow,
  findHeaderRowIndex,
  guessColumnMapStrict,
  matchTradeForSection,
  readBoqLayout,
  suggestAddGst,
} from './boqLayout';
import {
  applyColumnMap,
  buildImportedSections,
  guessColumnMap,
  groupImportRows,
  guessTradeIdForSection,
  parseDelimitedText,
} from './costPlanImport';
import {
  APP_TRADES,
  applyTradeAmountEdits,
  deriveCostPlanBoard,
  mergeTradeList,
  sumSectionAmounts,
} from './costPlan';
import type { CostPlan } from './schemas';
import { KELLY_BOQ } from './boqLayout.kelly';

function readKelly() {
  const rows = parseDelimitedText(KELLY_BOQ);
  const headerRowIndex = findHeaderRowIndex(rows);
  const map = guessColumnMapStrict(rows[headerRowIndex]);
  return { rows, headerRowIndex, map, layout: readBoqLayout(rows, map, headerRowIndex) };
}

describe('the flat-table import cannot read a Bill of Quantities', () => {
  test('row 0 is the spreadsheet title, so the naive header guess maps nothing', () => {
    const rows = parseDelimitedText(KELLY_BOQ);
    const map = guessColumnMap(rows[0]);
    expect(Object.values(map).every((role) => role === 'ignore')).toBe(true);
    expect(groupImportRows(applyColumnMap(rows, map, 0))).toHaveLength(0);
  });

  test('even with the right header row, every line becomes its own section', () => {
    const rows = parseDelimitedText(KELLY_BOQ);
    const map = guessColumnMap(rows[5]);
    const sections = groupImportRows(applyColumnMap(rows, map, 5));
    expect(sections.length).toBeGreaterThan(20);
    const total = sections.reduce((sum, section) => sum + section.amountCents, 0);
    expect(total).toBeGreaterThan(90000000);
  });
});

describe('reading a Bill of Quantities by row shape', () => {
  test('finds the column header under the cover block', () => {
    const { headerRowIndex, rows } = readKelly();
    expect(headerRowIndex).toBe(5);
    expect(rows[headerRowIndex][0]).toBe('Item Code');
  });

  test('Price is the unit rate and Total is the line amount', () => {
    const { map } = readKelly();
    expect(map[4]).toBe('unitPrice');
    expect(map[5]).toBe('amount');
  });

  test('classifies headings, lines, section totals and the grand-total block', () => {
    const { rows, map, headerRowIndex } = readKelly();
    const header = rows[headerRowIndex];
    expect(classifyBoqRow(rows[4], map, header)).toBe('section');
    expect(classifyBoqRow(rows[6], map, header)).toBe('line');
    expect(classifyBoqRow(rows[20], map, header)).toBe('sectionTotal');
    expect(classifyBoqRow(rows[headerRowIndex], map, header)).toBe('header');
    expect(classifyBoqRow(rows[rows.length - 3], map, header)).toBe('grandTotal');
  });

  test('produces one section per trade heading, not one per line', () => {
    const { layout } = readKelly();
    expect(layout.sections.map((section) => section.name)).toEqual([
      'Site Works - Planning approval and site requirements',
      'Concreting',
      'Plumbing',
      'Painting',
      'Scaffolding',
    ]);
    expect(layout.sections[0].rows).toHaveLength(14);
  });

  test('section amounts match the file, and cent drift defers to the stated total', () => {
    const { layout } = readKelly();
    const byName = Object.fromEntries(layout.sections.map((s) => [s.name, s.amountCents]));
    expect(byName.Concreting).toBe(3737291);
    // The three plumbing lines add to 17,272.72; the file's own total says .73.
    expect(byName.Plumbing).toBe(1727273);
    const total = layout.sections.reduce((sum, section) => sum + section.amountCents, 0);
    expect(total).toBe(9520327);
  });

  test('keeps the grand-total block as labelled figures rather than sections', () => {
    const { layout } = readKelly();
    const labels = layout.grandTotals.map((entry) => entry.label);
    expect(labels).toContain('GST');
    expect(labels).toContain('Sum including');
    const incGst = layout.grandTotals.find((entry) => entry.label === 'Sum including');
    expect(incGst?.amountCents).toBe(35410792);
  });

  test('a duplicate source code is a warning, never an identifier', () => {
    const { layout } = readKelly();
    expect(layout.warnings.some((warning) => warning.includes('15.000'))).toBe(true);
    expect(layout.sections.filter((section) => section.code === '15.000')).toHaveLength(2);
  });

  test('trade names come through cleanly enough to auto-map', () => {
    const { layout } = readKelly();
    const mapped = layout.sections.filter((section) => guessTradeIdForSection(section.name));
    expect(mapped).toHaveLength(layout.sections.length);
  });
});

describe('the layout reader drops into the existing import pipeline', () => {
  test('a BoqSection is shape-compatible with SourceSection', () => {
    const rows = parseDelimitedText(KELLY_BOQ);
    const headerRowIndex = findHeaderRowIndex(rows);
    const { sections } = readBoqLayout(rows, guessColumnMapStrict(rows[headerRowIndex]), headerRowIndex);
    const built = buildImportedSections(
      sections,
      Object.fromEntries(
        sections.map((section) => [section.key, guessTradeIdForSection(section.name) || 'other']),
      ),
      Object.fromEntries(APP_TRADES.map((trade) => [trade.id, trade.name])),
    );
    const total = built.reduce((sum, section) => sum + Number(section.amountCents || 0), 0);
    expect(total).toBe(9520327);
    expect(sections.every((section) => Array.isArray(section.duplicateCodes))).toBe(true);
    expect(sections.filter((section) => section.duplicateCodes.length > 0)).toHaveLength(2);
  });
});

describe('the file has to corroborate the total before anything is saved', () => {
  function readAt(headerRowIndex?: number) {
    const rows = parseDelimitedText(KELLY_BOQ);
    const index = headerRowIndex ?? findHeaderRowIndex(rows);
    const layout = readBoqLayout(rows, guessColumnMapStrict(rows[index] || []), index);
    const total = layout.sections.reduce((sum, section) => sum + section.amountCents, 0);
    return { layout, total, check: checkAgainstFileTotals(total, layout.grandTotals) };
  }

  test('a wrong header row maps no amount column, and zero does not corroborate zero', () => {
    const { layout, check } = readAt(0);
    expect(layout.sections).toHaveLength(0);
    expect(check.corroborated).toBe(false);
    expect(layout.warnings.some((w) => w.includes('No column is mapped as the line total'))).toBe(true);
  });

  test('a partial read is caught, because it cannot add up to a figure in the file', () => {
    // The fixture reproduces 5 of the 21 sections, so its total is real but incomplete.
    const { total, check } = readAt();
    expect(total).toBe(9520327);
    expect(check.statedCount).toBeGreaterThan(0);
    expect(check.corroborated).toBe(false);
  });

  test('a total that equals a figure the file states is corroborated', () => {
    const grandTotals = [
      { label: 'Construction cost', amountCents: 9520327 as never },
      { label: 'GST', amountCents: 952033 as never },
    ];
    const check = checkAgainstFileTotals(9520327, grandTotals);
    expect(check.corroborated).toBe(true);
    expect(check.matchedLabel).toBe('Construction cost');
  });

  test('uses the file section total when the lines include that total again', () => {
    const csv = [
      '1.000,Site Works,,,,',
      'Item Code,Description,Qty,Unit,Price,Total',
      '1.001,Fence,1.00,LS,100.00,100.00',
      '1.002,Total for site,1.00,LS,100.00,100.00',
      ',,,,Total,100.00',
      ',,,,Construction Cost,100.00',
    ].join('\n');
    const rows = parseDelimitedText(csv);
    const headerRowIndex = findHeaderRowIndex(rows);
    const layout = readBoqLayout(rows, guessColumnMapStrict(rows[headerRowIndex]), headerRowIndex);
    expect(layout.sections).toHaveLength(1);
    expect(layout.sections[0].amountCents).toBe(10000);
    expect(layout.warnings.some((warning) => warning.includes("Using the file's total"))).toBe(true);
  });

  test('a Total in the description is a section total, not a line', () => {
    const header = ['Item Code', 'Description', 'Qty', 'Unit', 'Price', 'Total'];
    const map = guessColumnMapStrict(header);
    expect(classifyBoqRow(['', 'Total Site Works', '', '', '', '100.00'], map, header)).toBe('sectionTotal');
  });

  test('an edited total that equals Sum including is corroborated even if the unread layout is not', () => {
    const grandTotals = [
      { label: 'Construction Cost', amountCents: 32_191_629 as never },
      { label: 'Sum including', amountCents: 35_410_792 as never },
    ];
    const unread = 66_776_421;
    expect(checkAgainstFileTotals(unread, grandTotals).corroborated).toBe(false);
    const check = bestFileTotalCheck([unread, 35_410_792], grandTotals);
    expect(check.corroborated).toBe(true);
    expect(check.matchedLabel).toBe('Sum including');
  });

  test('a file that states nothing is not blocked, there is just nothing to check', () => {
    const check = checkAgainstFileTotals(9520327, []);
    expect(check.statedCount).toBe(0);
    expect(check.corroborated).toBe(false);
  });

  test('suggests Add GST when the file states construction cost and that figure plus 10 percent', () => {
    expect(suggestAddGst(32_191_629, [
      { label: 'Construction Cost', amountCents: 32_191_629 as never },
      { label: 'GST', amountCents: 3_219_163 as never },
      { label: 'Sum including', amountCents: 35_410_792 as never },
    ])).toBe(true);
    expect(suggestAddGst(35_410_792, [
      { label: 'Sum including', amountCents: 35_410_792 as never },
    ])).toBe(false);
  });
});

describe('trade naming needs a synonym table, not a model', () => {
  test('matches the headings a literal substring rule misses', () => {
    expect(matchTradeForSection('Cladding/ Hebel/Brick Work')).toBe('brickwork');
    expect(matchTradeForSection('Insualtion, Gyprock & Render')).toBe('plastering');
    expect(matchTradeForSection('Kitchen & Laundry')).toBe('kitchen-joinery');
    expect(matchTradeForSection('Roof and Eaves')).toBe('roofing');
    expect(matchTradeForSection('Air-Conditioning')).toBe('hvac');
    expect(matchTradeForSection('Tiling and Floor Covering')).toBe('tiling-flooring');
    expect(matchTradeForSection('Doors, frames, architraves & Skirting')).toBe('windows-doors');
  });

  test('the longest matching word wins, so a compound heading is not mis-sorted', () => {
    expect(matchTradeForSection('Waterproofing and silicon')).toBe('waterproofing');
    expect(matchTradeForSection('Stairs, balustrade and railing')).toBe('other');
  });

  test('respects the organisation trade list when one is given', () => {
    expect(matchTradeForSection('Concreting', ['painting'])).toBeNull();
    expect(matchTradeForSection('Concreting', ['concreting', 'painting'])).toBe('concreting');
  });

  test('every heading in the Kelly St estimate resolves', () => {
    const rows = parseDelimitedText(KELLY_BOQ);
    const index = findHeaderRowIndex(rows);
    const { sections } = readBoqLayout(rows, guessColumnMapStrict(rows[index]), index);
    expect(sections.filter((section) => matchTradeForSection(section.name))).toHaveLength(sections.length);
  });
});

/**
 * A working estimate tracks actuals beside the estimate. Those columns are money
 * shaped and sit to the right, so "rightmost money column wins" gave the amount
 * role to "Actual Total", which is all zeros until the job is spent. The real
 * 167sqm single-storey estimate read as $0.00 for all 22 sections because of it,
 * and the file-total check correctly refused to save the plan.
 */
describe('estimate columns beat the file\'s own actuals columns', () => {
  const header = ['Item Code', 'Description', 'Qty', 'Unit', 'Price', 'Total', 'Comments', '', '', '', 'Actual Price', 'Actual Total'];
  const rows = [
    ['Single Storey', '', '', '', '', '', '', '', '', '', '', ''],
    ['1', 'Site Works', '', '', '', '', '', '', '', '', '', ''],
    header,
    ['1.001', 'Temporary Fence', '92', 'LS', '9', '828', '', '', '', '', '', '0'],
    ['1.002', 'Toilet', '1', 'LS', '950', '950', '', '', '', '', '', '0'],
    ['', '', '', '', 'Total', '1778', '', '', '', '', '', '0'],
  ];

  it('ignores Actual Price and Actual Total by their headers alone', () => {
    const map = guessColumnMapStrict(header);
    expect(map[5]).toBe('amount');
    expect(map[4]).toBe('unitPrice');
    expect(map[10]).toBe('ignore');
    expect(map[11]).toBe('ignore');
  });

  it('reads the estimate, not zero', () => {
    const index = findHeaderRowIndex(rows);
    const layout = readBoqLayout(rows, guessColumnMapStrict(rows[index], rows), index);
    expect(layout.sections).toHaveLength(1);
    expect(layout.sections[0].amountCents).toBe(177800);
  });

  it('drops a money column that holds no figures, whatever its header says', () => {
    const quiet = ['Code', 'Description', 'Qty', 'Unit', 'Rate', 'Total', 'Committed Cost'];
    const quietRows = [
      ['1', 'Concreting', '', '', '', '', ''],
      quiet,
      ['1.001', 'Slab', '1', 'LS', '500', '500', ''],
      ['1.002', 'Piering', '1', 'LS', '250', '250', '0'],
    ];
    const index = findHeaderRowIndex(quietRows);
    const map = guessColumnMapStrict(quietRows[index], quietRows);
    expect(map[5]).toBe('amount');
    expect(map[6]).toBe('ignore');
    const layout = readBoqLayout(quietRows, map, index);
    expect(layout.sections[0].amountCents).toBe(75000);
  });
});

/**
 * Phase 17 Part D: the owner can add a section himself. It is a bucket spend
 * can be coded to, with no allocation, and it must never move the estimate.
 * The fixture is the real Kelly St bill of quantities, trimmed to 5 of 21
 * sections; its stated Construction Cost is the owner's $321,916.29. The
 * estimate the app holds is that stated figure, so that is the number pinned
 * here to the cent. (There is no 112 Cost Sheet.xlsx fixture in the repo;
 * this is the real-file fixture the import tests share.)
 */
describe('adding a section after import never moves the $321,916.29 estimate', () => {
  function importedPlan(): { plan: CostPlan; importedTotal: number } {
    const rows = parseDelimitedText(KELLY_BOQ);
    const headerRowIndex = findHeaderRowIndex(rows);
    const layout = readBoqLayout(rows, guessColumnMapStrict(rows[headerRowIndex]), headerRowIndex);
    const stated = layout.grandTotals.find((entry) => entry.amountCents === 32_191_629);
    expect(stated?.label).toContain('Construction Cost');
    const sections = buildImportedSections(
      layout.sections,
      Object.fromEntries(
        layout.sections.map((section) => [section.key, guessTradeIdForSection(section.name) || 'other']),
      ),
      Object.fromEntries(APP_TRADES.map((trade) => [trade.id, trade.name])),
    );
    const plan: CostPlan = {
      id: 'current',
      jobId: 'job-1',
      level: 'imported',
      // The file's stated Construction Cost, reconciled before save.
      targetCents: 32_191_629,
      baselineDate: '2026-05-29',
      gstMode: 'exclusive',
      status: 'locked',
      sections,
      createdBy: 'owner-1',
      archivedAt: null,
    };
    return { plan, importedTotal: sumSectionAmounts(sections) };
  }

  test('a zero-allocation section cannot enter the plan, so the total holds to the cent', () => {
    const { plan, importedTotal } = importedPlan();
    const before = deriveCostPlanBoard({ plan, trades: mergeTradeList([]) });
    expect(plan.targetCents).toBe(32_191_629);
    expect(before.estimatedCents).toBe(importedTotal);

    // The owner adds "Waste and bins". addOrgTrade writes the org trade list
    // only; the plan document is untouched, and a zero amount is filtered out
    // of any sections write.
    const tradesWithNew = mergeTradeList([{
      id: 'waste-removal',
      name: 'Waste and bins',
      order: APP_TRADES.length,
      isAppDefault: true,
      status: 'active',
    }]);
    expect(tradesWithNew.some((trade) => trade.id === 'waste-removal')).toBe(true);
    const rewritten = applyTradeAmountEdits(plan.sections, [
      ...plan.sections.map((section) => ({
        tradeId: section.tradeId,
        name: section.name,
        amountCents: section.amountCents,
      })),
      { tradeId: 'waste-removal', name: 'Waste and bins', amountCents: 0 },
    ]);
    // Zero-amount rows are filtered out of any sections write, so the new
    // section cannot enter the plan with an allocation of zero — or anything.
    expect(rewritten.some((section) => section.tradeId === 'waste-removal')).toBe(false);
    expect(sumSectionAmounts(rewritten)).toBe(importedTotal);

    // Spend coded to the new section shows against its zero allocation,
    // exactly like the existing "Not in the estimate" extras. The estimate
    // and the target do not move a cent; the forecast honestly counts the
    // spend once.
    const after = deriveCostPlanBoard({
      plan,
      expenses: [{ id: 'e-skip', tradeId: 'waste-removal', itemName: 'Skip bin', total: 480 }],
      trades: tradesWithNew,
    });
    expect(plan.targetCents).toBe(32_191_629);
    expect(after.estimatedCents).toBe(before.estimatedCents);
    expect(after.expectedCents).toBe((before.expectedCents || 0) + 48_000);
    const extra = after.extras.rows.find((row) => row.tradeId === 'waste-removal');
    expect(extra?.label).toBe('Waste and bins');
    expect(extra?.spentCents).toBe(48_000);
  });
});

/**
 * The total-label tests read every cell in the row, so a comment against a real
 * line item that happens to contain "GST" or "sum including" turned that item
 * into a phantom grand total and its money left the section. A numbered line is
 * a line, whatever an estimator wrote in the notes column beside it.
 */
describe('a note mentioning GST does not turn a line item into a total', () => {
  const rows = [
    ['12', 'Kitchen, Laundry, Vanities', '', '', '', '', '', '', ''],
    ['Item Code', 'Description', 'Qty', 'Unit', 'Price', 'Total', 'Comments', '', ''],
    ['12.001', 'Supply and install kitchen cabinetry', '1', 'LS', '14660', '14660', 'Allowances only', '$39,500 Plus GST', 'Mark gave prices'],
    ['12.002', 'Supply and install Laundry cabinetry', '1', 'LS', '1000', '1000', '', '', ''],
    ['', '', '', '', 'Total', '15660', '', '', ''],
  ];

  it('keeps the noted line inside its section', () => {
    const index = findHeaderRowIndex(rows);
    const layout = readBoqLayout(rows, guessColumnMapStrict(rows[index], rows), index);
    expect(layout.sections).toHaveLength(1);
    expect(layout.sections[0].rows).toHaveLength(2);
    expect(layout.sections[0].amountCents).toBe(1566000);
    expect(layout.grandTotals).toHaveLength(0);
    expect(layout.warnings).toHaveLength(0);
  });
});
