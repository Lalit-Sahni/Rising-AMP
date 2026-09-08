import { proposeTrades, splitTradeProposals } from './proposeTrades';

const TRADES = [
  { id: 'concreting', name: 'Concreting' },
  { id: 'plumbing', name: 'Plumbing' },
  { id: 'carpentry', name: 'Carpentry' },
];

const SECTIONS = [
  { id: 'concreting', name: 'Concreting' },
  { id: 'plumbing', name: 'Plumbing' },
];

function bunningsCoded(count: number, tradeId = 'concreting') {
  return Array.from({ length: count }, (_, index) => ({
    id: `coded-${tradeId}-${index}`,
    jobId: 'job-a',
    partyId: 'party-bunnings',
    supplier: 'Bunnings',
    tradeId,
    status: 'active',
  }));
}

describe('proposeTrades', () => {
  test('empty uncoded returns empty', () => {
    expect(proposeTrades({
      uncoded: [],
      orgCoded: bunningsCoded(11),
      trades: TRADES,
      sections: SECTIONS,
    })).toEqual([]);
  });

  test('already-coded rows are omitted', () => {
    const rows = proposeTrades({
      uncoded: [
        { id: 'e-coded', partyId: 'party-bunnings', tradeId: 'plumbing' },
        { id: 'e-open', partyId: 'party-bunnings', supplier: 'Bunnings' },
      ],
      orgCoded: bunningsCoded(11),
      trades: TRADES,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].expenseId).toBe('e-open');
  });

  test('Bunnings coded to concreting 11 times is confident', () => {
    const [row] = proposeTrades({
      uncoded: [{
        id: 'e-new',
        partyId: 'party-bunnings',
        supplier: 'Bunnings',
        description: 'Timber screws',
      }],
      orgCoded: bunningsCoded(11),
      trades: TRADES,
      sections: SECTIONS,
    });
    expect(row.status).toBe('confident');
    expect(row.source).toBe('record');
    expect(row.proposedTradeId).toBe('concreting');
    expect(row.proposedTradeName).toBe('Concreting');
    expect(row.reason).toMatch(/11 times/);
  });

  test('one prior code is not confident from party history', () => {
    const [row] = proposeTrades({
      uncoded: [{
        id: 'e-new',
        partyId: 'party-bunnings',
        supplier: 'Bunnings',
      }],
      orgCoded: bunningsCoded(1),
      trades: TRADES,
    });
    expect(row.status).toBe('none');
    expect(row.source).toBeNull();
    expect(row.proposedTradeId).toBeNull();
  });

  test('a party-history tie is none from party', () => {
    const [row] = proposeTrades({
      uncoded: [{
        id: 'e-new',
        partyId: 'party-bunnings',
        supplier: 'Bunnings',
      }],
      orgCoded: [...bunningsCoded(4, 'concreting'), ...bunningsCoded(4, 'carpentry')],
      trades: TRADES,
    });
    expect(row.status).toBe('none');
    expect(row.source).toBeNull();
    expect(row.proposedTradeId).toBeNull();
  });

  test('electronic lock does not match Electrical, waterpark does not match Waterproofing, and junk is none', () => {
    const sections = [
      ...SECTIONS,
      { id: 'electrical', name: 'Electrical' },
      { id: 'waterproofing', name: 'Waterproofing' },
    ];
    const rows = proposeTrades({
      uncoded: [
        { id: 'e-lock', description: 'electronic lock' },
        { id: 'e-park', itemName: 'waterpark ticket' },
        { id: 'e-ing', notes: 'ing' },
        { id: 'e-air', supplier: 'air' },
        { id: 'e-xx', description: 'xx' },
        { id: 'e-junk', description: 'banana-xyz' },
      ],
      orgCoded: [],
      trades: [...TRADES, { id: 'electrical', name: 'Electrical' }, { id: 'waterproofing', name: 'Waterproofing' }],
      sections,
    });
    expect(rows.every((row) => row.status === 'none' && row.proposedTradeId == null)).toBe(true);
  });

  test('a supplier named concrete pump is not section-match evidence', () => {
    const [row] = proposeTrades({
      uncoded: [{ id: 'e-sup', supplier: 'concrete pump' }],
      orgCoded: [],
      trades: TRADES,
      sections: SECTIONS,
    });
    expect(row.status).toBe('none');
    expect(row.proposedTradeId).toBeNull();
  });

  test('concrete pump matching the Concreting section is uncertain inferred', () => {
    const [row] = proposeTrades({
      uncoded: [{
        id: 'e-pump',
        description: 'concrete pump',
      }],
      orgCoded: [],
      trades: TRADES,
      sections: SECTIONS,
    });
    expect(row.status).toBe('uncertain');
    expect(row.source).toBe('inferred');
    expect(row.proposedTradeId).toBe('concreting');
    expect(row.reason).toMatch(/Concreting/);
  });

  test('a trade category exact name match is uncertain inferred', () => {
    const [row] = proposeTrades({
      uncoded: [{
        id: 'e-trade',
        category: 'trade',
        tradeName: 'Plumbing',
      }],
      orgCoded: [],
      trades: TRADES,
    });
    expect(row.status).toBe('uncertain');
    expect(row.source).toBe('inferred');
    expect(row.proposedTradeId).toBe('plumbing');
  });

  test('other categories do not invent a trade from the name', () => {
    const [row] = proposeTrades({
      uncoded: [{
        id: 'e-buy',
        category: 'purchase',
        tradeName: 'Plumbing',
        itemName: 'Pipe',
      }],
      orgCoded: [],
      trades: TRADES,
    });
    expect(row.status).toBe('none');
    expect(row.proposedTradeId).toBeNull();
  });

  test('void and investor rows are not proposed', () => {
    const rows = proposeTrades({
      uncoded: [
        { id: 'e-void', status: 'void', partyId: 'party-bunnings' },
        { id: 'e-inv', category: 'investor', itemName: 'Legal' },
      ],
      orgCoded: bunningsCoded(11),
      trades: TRADES,
    });
    expect(rows).toEqual([]);
  });

  test('split keeps uncertain out of confident', () => {
    const rows = proposeTrades({
      uncoded: [
        { id: 'e-bun', partyId: 'party-bunnings' },
        { id: 'e-pump', description: 'concrete pump' },
        { id: 'e-none', itemName: 'Mystery' },
      ],
      orgCoded: bunningsCoded(11),
      trades: TRADES,
      sections: SECTIONS,
    });
    const split = splitTradeProposals(rows);
    expect(split.confident.map((row) => row.expenseId)).toEqual(['e-bun']);
    expect(split.uncertain.map((row) => row.expenseId)).toEqual(['e-pump']);
    expect(split.none.map((row) => row.expenseId)).toEqual(['e-none']);
  });
});
