import { detectUncertainFields } from './ocrUncertainty';

describe('detectUncertainFields', () => {
  test('flags a missing date and amount from extracted data and warnings', () => {
    const flags = detectUncertainFields({
      category: 'purchase',
      extractedData: { date: null, totalAmount: null },
      warnings: ['Date could not be read from the receipt', 'Total amount could not be determined'],
      formData: {},
    });
    expect(flags.date).toBe(true);
    expect(flags.unitCost).toBe(true);
  });

  test('does not flag a complete extraction', () => {
    const flags = detectUncertainFields({
      category: 'purchase',
      extractedData: { date: '2026-08-14', totalAmount: 412.9 },
      warnings: [],
      formData: { date: '2026-08-14', unitCost: 412.9 },
    });
    expect(flags.date).toBeFalsy();
    expect(flags.amount).toBeFalsy();
  });

  test('flags labour hours because the pipeline invents 8 hours', () => {
    const flags = detectUncertainFields({
      category: 'labour',
      extractedData: { date: '2026-08-14', totalAmount: 400 },
      warnings: [],
    });
    expect(flags.hours).toBe(true);
    expect(flags.date).toBeFalsy();
  });
});
