import { describe, expect, it } from 'vitest';
import { matchTrades } from './answers';

/**
 * Every search returned the same three trades, whatever was typed.
 *
 * matchTrades ended with `name.includes(alias)`, which never read the query. So
 * any trade whose display name contained one of its own aliases matched
 * everything: "Tiling and flooring" (flooring), "Kitchen and joinery" (joinery)
 * and "Air-conditioning" (air-conditioning).
 *
 * A second, milder fault: `hay.includes(q)` and `word.includes(q)` matched two
 * letters found anywhere, so "in" hit 13 of 20 trades (concret-in-g,
 * plumb-in-g, roof-in-g) and "er" hit 13.
 */
const TRADES = [
  ['site-works', 'Site works'],
  ['demolition', 'Demolition'],
  ['concreting', 'Concreting'],
  ['plumbing', 'Plumbing'],
  ['carpentry', 'Carpentry'],
  ['roofing', 'Roofing'],
  ['electrical', 'Electrical'],
  ['waterproofing', 'Waterproofing'],
  ['plastering', 'Plastering'],
  ['tiling-flooring', 'Tiling and flooring'],
  ['painting', 'Painting'],
  ['kitchen-joinery', 'Kitchen and joinery'],
  ['hvac', 'Air-conditioning'],
  ['landscaping', 'Landscaping'],
  ['other', 'Internal works and materials'],
].map(([id, name]) => ({ id, name, order: 0, isAppDefault: true, status: 'active' as const }));

describe('matchTrades', () => {
  it('returns nothing for a query that names no trade', () => {
    ['xy', 'mark', 'bunnings', 'slab cert', 'how much did we spend', 'zzz'].forEach((q) => {
      expect(matchTrades(TRADES, q), `"${q}" should match no trade`).toHaveLength(0);
    });
  });

  it('never returns a trade just because its name contains its own alias', () => {
    const always = ['Tiling and flooring', 'Kitchen and joinery', 'Air-conditioning'];
    const hits = matchTrades(TRADES, 'xy').map((t) => t.name);
    always.forEach((name) => expect(hits).not.toContain(name));
  });

  it('does not match two letters found in the middle of a word', () => {
    expect(matchTrades(TRADES, 'er')).toHaveLength(0);
    expect(matchTrades(TRADES, 'on')).toHaveLength(0);
    // "in" is a real prefix of "internal", and only that.
    expect(matchTrades(TRADES, 'in').map((t) => t.id)).toEqual(['other']);
  });

  it('finds the one trade a real query names', () => {
    const cases: Array<[string, string]> = [
      ['concreting', 'concreting'],
      ['concrete', 'concreting'],
      ['kitchen', 'kitchen-joinery'],
      ['joinery', 'kitchen-joinery'],
      ['plumb', 'plumbing'],
      ['plumber', 'plumbing'],
      ['aircon', 'hvac'],
      ['tiling', 'tiling-flooring'],
      ['paint', 'painting'],
      ['elect', 'electrical'],
    ];
    cases.forEach(([q, id]) => {
      expect(matchTrades(TRADES, q).map((t) => t.id), `"${q}"`).toContain(id);
      expect(matchTrades(TRADES, q).length, `"${q}" should be specific`).toBeLessThanOrEqual(2);
    });
  });

  it('ignores archived trades and very short queries', () => {
    expect(matchTrades(TRADES, 'c')).toHaveLength(0);
    const archived = TRADES.map((t) => ({ ...t, status: 'archived' as const }));
    expect(matchTrades(archived, 'concreting')).toHaveLength(0);
  });
});
