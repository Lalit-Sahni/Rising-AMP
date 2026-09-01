import {
  applyColumnMap,
  buildImportedSections,
  guessColumnMap,
  guessTradeIdForSection,
  groupImportRows,
  importWarnings,
  parseDelimitedText,
  reconcileImportedPlan,
} from './costPlanImport';

describe('cost plan spreadsheet import', () => {
  const csv = [
    'Code,Section,Description,Amount',
    '2.000,Concreting,Slab,41110',
    '15.000,Painting,Internal,10386.36',
    '15.000,Scaffolding,Hire,2400',
  ].join('\n');

  test('parses delimited text without treating codes as identifiers', () => {
    const rows = parseDelimitedText(csv);
    const map = guessColumnMap(rows[0]);
    expect(map[0]).toBe('code');
    expect(map[1]).toBe('section');
    expect(map[3]).toBe('amount');
    const grouped = groupImportRows(applyColumnMap(rows, map));
    expect(grouped.map((section) => section.name)).toEqual(['Concreting', 'Painting', 'Scaffolding']);
    const warnings = importWarnings(grouped);
    expect(warnings.some((warning) => warning.includes('15.000'))).toBe(true);
  });

  test('mapping to trades must reconcile before save', () => {
    const rows = parseDelimitedText(csv);
    const grouped = groupImportRows(applyColumnMap(rows, guessColumnMap(rows[0])));
    const sections = buildImportedSections(
      grouped,
      {
        concreting: 'concreting',
        painting: 'painting',
        scaffolding: 'scaffolding',
      },
      {
        concreting: 'Concreting',
        painting: 'Painting',
        scaffolding: 'Scaffolding',
      },
    );
    expect(guessTradeIdForSection('Concreting')).toBe('concreting');
    const ok = reconcileImportedPlan(sections, 4111000 + 1038636 + 240000);
    expect(ok.ok).toBe(true);
    expect(reconcileImportedPlan(sections, 1).ok).toBe(false);
  });
});
