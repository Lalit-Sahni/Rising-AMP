import { buildEstimateCheckPayload, parseEstimateCheckContent } from './estimateCheck';

describe('estimate import AI check', () => {
  test('builds a capped payload from the mapped plan', () => {
    const payload = buildEstimateCheckPayload({
      fileName: 'Kelly.xlsx',
      headerRow: ['Item Code', 'Description', 'Qty', 'Unit', 'Price', 'Total'],
      rows: [['Item Code', 'Description'], ['2.000', 'Concreting']],
      headerRowIndex: 0,
      grandTotals: [{ label: 'Construction Cost', amountCents: 32191629 }],
      layoutTotalCents: 32191629,
      addGst: true,
      planTotalCents: 35410792,
      sections: [{
        name: 'Concreting',
        code: '2.000',
        amountCents: 3737291,
        tradeName: 'Concreting',
        lines: [{ description: 'Slab', totalCents: 2432291 }],
      }],
    });
    expect(payload.addGst).toBe(true);
    expect(payload.sections[0].tradeName).toBe('Concreting');
    expect(payload.sampleRows[0][0]).toBe('Item Code');
  });

  test('parses a fenced JSON review', () => {
    const result = parseEstimateCheckContent('```json\n{"ok":false,"summary":"Painting is under plumbing.","warnings":["Painting is mapped to Plumbing."]}\n```');
    expect(result.ok).toBe(false);
    expect(result.warnings).toEqual(['Painting is mapped to Plumbing.']);
  });
});
