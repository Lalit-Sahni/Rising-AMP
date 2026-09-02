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
import { APP_TRADES } from './costPlan';

/**
 * The real Kelly St Bill of Quantities layout: a cover block, a section heading
 * ABOVE the first column header, the column header repeated before every
 * section, a Total row after every section, and a grand-total block at the end.
 * Section figures are the actual ones from the 29 May 2026 estimate.
 */
const KELLY_BOQ = [
  ',Sinlge Storey - 18 Square or 167.22 Sqm,,,,',
  ',Bill of Quantities,,,,',
  ',,,,Built Area (Sqm),167.22',
  ',,,,Date,29/5/2026',
  '1.000,Site Works - Planning approval and site requirements,,,,',
  'Item Code,Description,Qty,Unit,Price,Total',
  '1.001,Temporary Fence,92.00,LS,9.00,828.00',
  '1.002,Sediment control,1.00,LS,650.00,650.00',
  '1.003,Toilet,1.00,LS,950.00,950.00',
  '1.003,Architectural plans Including all other plans,1.00,LS,13636.36,13636.36',
  '1.01,Long Service Levy,1.00,LS,912.00,912.00',
  '1.011,Home Warranty Insurance,1.00,LS,5718.18,5718.18',
  '1.014,Certifier - CDC,1.00,LS,3272.73,3272.73',
  '1.02,Engineers inspection,3.00,Each,325.00,975.00',
  '1.021,Pegout Survey,1.00,Job,550.00,550.00',
  '1.022,Formwork check,1.00,Job,-,-',
  '1.023,Nails on slab,1.00,Job,450.00,450.00',
  '1.024,Final Survey,1.00,Job,550.00,550.00',
  '1.025,Interim Occupation Certificate,1.00,Job,49.00,49.00',
  '1.026,Termite treatment,1.00,Job,1630.00,1630.00',
  ',,,,Total,30171.27',
  ',,,,,',
  '2.000,Concreting,,,,',
  'Item Code,Description,Qty,Unit,Price,Total',
  '2.001,Benching,1.00,Per House,1500.00,1500.00',
  '2.002,Excavation,5.00,Loads,650.00,3250.00',
  '2.003,Piering,60.00,LM,90.00,5400.00',
  '2.004,Pump Hire for Concrete,2.00,Per Hire,650.00,1300.00',
  '2.005,Concrete Slab,167.22,SQM,145.45,24322.91',
  '2.006,Drop Edge Beams,5.00,SQM,320.00,1600.00',
  '2.007,Pad Footing,1.00,LS,-,-',
  ',,,,Total,37372.91',
  ',,,,,',
  '3.000,Plumbing,,,,',
  'Item Code,Description,Qty,Unit,Price,Total',
  '3.001,Supply and install hot water unit - 26L,1.00,Per House,909.09,909.09',
  '3.002,Plumbing Work - Includes drainage stormwater work,1.00,Per House,14545.45,14545.45',
  '3.003,Rainwater Tank -2000 Litre,1.00,Per Tank,1818.18,1818.18',
  '3.004,Path valve connection for granny flat,-,Charges,,-',
  ',,,,Total,17272.73',
  ',,,,,',
  '15.000,Painting,,,,',
  'Item Code,Description,Qty,Unit,Price,Total',
  '15.001,Painting work,1.00,LS,10386.36,10386.36',
  ',,,,Total,10386.36',
  ',,,,,',
  '15.000,Scaffolding,,,,',
  'Item Code,Description,Qty,Unit,Price,Total',
  '15.001,Scaffolding,1.00,LS,,-',
  ',,,,Total,-',
  ',,,,,',
  ',Construction Cost + GST - Sum to Total,,,,321916.29',
  ',,,,GST,32191.63',
  ',,,,Sum including,354107.92',
  ',,,,Unit rate,2117.62',
].join('\n');

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
