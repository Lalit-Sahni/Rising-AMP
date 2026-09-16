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

  test('one prior code is uncertain, naming the trade coded once', () => {
    const [row] = proposeTrades({
      uncoded: [{
        id: 'e-new',
        partyId: 'party-bunnings',
        supplier: 'Bunnings',
      }],
      orgCoded: bunningsCoded(1),
      trades: TRADES,
    });
    expect(row.status).toBe('uncertain');
    expect(row.source).toBe('inferred');
    expect(row.proposedTradeId).toBe('concreting');
    expect(row.reason).toBe('Coded to Concreting once for this supplier.');
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

  test('a supplier named concrete pump proposes from the name, always uncertain', () => {
    const [row] = proposeTrades({
      uncoded: [{ id: 'e-sup', supplier: 'concrete pump' }],
      orgCoded: [],
      trades: TRADES,
      sections: SECTIONS,
    });
    expect(row.status).toBe('uncertain');
    expect(row.source).toBe('inferred');
    expect(row.proposedTradeId).toBe('concreting');
    expect(row.reason).toBe('Supplier name matches the Concreting section.');
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

  describe('name fields are hints, never facts', () => {
    const NAME_TRADES = [
      ...TRADES,
      { id: 'electrical', name: 'Electrical' },
      { id: 'roofing', name: 'Roofing' },
    ];
    const NAME_SECTIONS = [
      ...SECTIONS,
      { id: 'electrical', name: 'Electrical' },
      { id: 'roofing', name: 'Roofing' },
    ];

    test.each([
      {
        id: 'supplier',
        expense: { supplier: "Jim's Electrical Pty Ltd", description: 'progress claim 2' },
        tradeId: 'electrical',
        reason: 'Supplier name matches the Electrical section.',
      },
      {
        id: 'workerName',
        expense: { workerName: 'Jim the plumber' },
        tradeId: 'plumbing',
        reason: 'Worker name matches the Plumbing section.',
      },
      {
        id: 'serviceName',
        expense: { serviceName: 'Roofing repairs' },
        tradeId: 'roofing',
        reason: 'Service name matches the Roofing section.',
      },
      {
        id: 'equipmentName',
        expense: { equipmentName: 'concrete pump' },
        tradeId: 'concreting',
        reason: 'Equipment name matches the Concreting section.',
      },
      {
        id: 'partyName on the expense',
        expense: { partyName: 'Metro Electrical' },
        tradeId: 'electrical',
        reason: 'Party name matches the Electrical section.',
      },
    ])('$id alone proposes $tradeId as uncertain inferred, naming the field', ({ expense, tradeId, reason }) => {
      const [row] = proposeTrades({
        uncoded: [{ id: 'e-name', ...expense }],
        orgCoded: [],
        trades: NAME_TRADES,
        sections: NAME_SECTIONS,
      });
      expect(row.status).toBe('uncertain');
      expect(row.source).toBe('inferred');
      expect(row.proposedTradeId).toBe(tradeId);
      expect(row.reason).toBe(reason);
    });

    test('a first expense from a known supplier proposes via partyNamesById', () => {
      const [row] = proposeTrades({
        uncoded: [{
          id: 'e-first',
          partyId: 'party-jim',
          description: 'progress claim 2',
        }],
        orgCoded: [],
        trades: NAME_TRADES,
        sections: NAME_SECTIONS,
        partyNamesById: new Map([['party-jim', "Jim's Electrical Pty Ltd"]]),
      });
      expect(row.status).toBe('uncertain');
      expect(row.source).toBe('inferred');
      expect(row.proposedTradeId).toBe('electrical');
      expect(row.reason).toBe('Party name matches the Electrical section.');
    });

    test('a name match never returns confident, even with strong wording', () => {
      const rows = proposeTrades({
        uncoded: [
          { id: 'e-strong', supplier: 'Electrical switchboard electrical wiring electrician' },
          { id: 'e-both', description: 'electrical rough-in', supplier: "Jim's Electrical" },
          { id: 'e-resolved', partyId: 'party-jim' },
        ],
        orgCoded: [],
        trades: NAME_TRADES,
        sections: NAME_SECTIONS,
        partyNamesById: new Map([['party-jim', 'Jim Electrical Electrical Electrical']]),
      });
      expect(rows).toHaveLength(3);
      rows.forEach((row) => {
        expect(row.status).toBe('uncertain');
        expect(row.source).toBe('inferred');
        expect(row.proposedTradeId).toBe('electrical');
      });
    });

    test('the reason names the winning field, not always the description', () => {
      const rows = proposeTrades({
        uncoded: [
          { id: 'e-desc', description: 'concrete pump' },
          { id: 'e-sup', description: 'progress claim 2', supplier: 'concrete pump' },
        ],
        orgCoded: [],
        trades: TRADES,
        sections: SECTIONS,
      });
      expect(rows[0].reason).toBe('Description matches the Concreting section.');
      expect(rows[1].reason).toBe('Supplier name matches the Concreting section.');
    });

    test('single prior coding beats a conflicting name hint', () => {
      const [row] = proposeTrades({
        uncoded: [{
          id: 'e-mixed',
          partyId: 'party-bunnings',
          supplier: 'Bunnings electrical',
        }],
        orgCoded: bunningsCoded(1),
        trades: NAME_TRADES,
        sections: NAME_SECTIONS,
      });
      expect(row.status).toBe('uncertain');
      expect(row.proposedTradeId).toBe('concreting');
      expect(row.reason).toBe('Coded to Concreting once for this supplier.');
    });

    test('two or more prior codings still win confident over any name', () => {
      const [row] = proposeTrades({
        uncoded: [{
          id: 'e-history',
          partyId: 'party-bunnings',
          supplier: 'Bunnings electrical',
        }],
        orgCoded: bunningsCoded(3),
        trades: NAME_TRADES,
        sections: NAME_SECTIONS,
      });
      expect(row.status).toBe('confident');
      expect(row.source).toBe('record');
      expect(row.proposedTradeId).toBe('concreting');
    });

    test('nonsense names still propose nothing', () => {
      const rows = proposeTrades({
        uncoded: [
          { id: 'e-sup', supplier: 'Mystery Pty Ltd' },
          { id: 'e-worker', workerName: 'Dave' },
          { id: 'e-service', serviceName: 'thingamajig hire' },
          { id: 'e-equip', equipmentName: 'whatchamacallit 3000' },
          { id: 'e-party-name', partyName: 'Globex' },
          { id: 'e-resolved', partyId: 'party-globex' },
        ],
        orgCoded: [],
        trades: NAME_TRADES,
        sections: NAME_SECTIONS,
        partyNamesById: new Map([['party-globex', 'Globex Corporation']]),
      });
      expect(rows.every((row) => row.status === 'none' && row.proposedTradeId == null)).toBe(true);
    });

    test('an electronic lock supplier is not Electrical, and partial words do not match', () => {
      const rows = proposeTrades({
        uncoded: [
          { id: 'e-lock', supplier: 'Electronic Locks R Us' },
          { id: 'e-roof', workerName: 'dave waterproofer' },
        ],
        orgCoded: [],
        trades: [...NAME_TRADES, { id: 'waterproofing', name: 'Waterproofing' }],
        sections: [...NAME_SECTIONS, { id: 'waterproofing', name: 'Waterproofing' }],
        partyNamesById: new Map(),
      });
      expect(rows.every((row) => row.status === 'none' && row.proposedTradeId == null)).toBe(true);
    });
  });
});
