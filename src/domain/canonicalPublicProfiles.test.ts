import {
  formatCanonicalProfilePlan,
  parseCanonicalProfileArgs,
  planCanonicalPublicProfileMoves,
} from './canonicalPublicProfiles';

describe('canonical publicProfiles backfill', () => {
  test('proposes copying a dotted Gmail card onto the canonical id', () => {
    const plans = planCanonicalPublicProfileMoves([
      {
        id: 'lalit.sahni@gmail.com',
        uid: 'uid-1',
        email: 'lalit.sahni@gmail.com',
        displayName: 'Lalit Sahni',
        photoUrl: 'https://example.com/p.jpg',
        mobile: '0400000000',
        abn: '32162378190',
      },
      {
        id: 'books@opal.test',
        uid: 'uid-2',
        email: 'books@opal.test',
        displayName: 'Books',
        photoUrl: '',
      },
    ]);
    expect(plans).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'copy',
        fromId: 'lalit.sahni@gmail.com',
        toId: 'lalitsahni@gmail.com',
        card: expect.objectContaining({
          uid: 'uid-1',
          email: 'lalitsahni@gmail.com',
          displayName: 'Lalit Sahni',
          photoUrl: 'https://example.com/p.jpg',
        }),
      }),
      expect.objectContaining({
        action: 'keep',
        fromId: 'books@opal.test',
        toId: 'books@opal.test',
      }),
    ]));
    expect(JSON.stringify(plans)).not.toMatch(/0400000000|32162378190|mobile|abn/);
    expect(formatCanonicalProfilePlan(plans)).toMatch(/copy lalit\.sahni@gmail\.com → lalitsahni@gmail\.com/);
  });

  test('does not overwrite a card already on the canonical id', () => {
    const plans = planCanonicalPublicProfileMoves([
      {
        id: 'lalit.sahni@gmail.com',
        uid: 'uid-dot',
        email: 'lalit.sahni@gmail.com',
        displayName: 'Dotted',
        photoUrl: '',
      },
      {
        id: 'lalitsahni@gmail.com',
        uid: 'uid-canon',
        email: 'lalitsahni@gmail.com',
        displayName: 'Canonical',
        photoUrl: '',
      },
    ]);
    expect(plans.find((row) => row.fromId === 'lalit.sahni@gmail.com')?.action)
      .toBe('skip-target-exists');
  });

  test('refuses --production without a second flag and never applies there', () => {
    expect(parseCanonicalProfileArgs(['--staging'])).toMatchObject({ apply: false, staging: true });
    expect(() => parseCanonicalProfileArgs(['--production'])).toThrow(/i-mean-production/);
    expect(() => parseCanonicalProfileArgs(['--apply', '--production', '--i-mean-production']))
      .toThrow(/apply on production/);
    expect(() => parseCanonicalProfileArgs(['--apply'])).toThrow(/staging only/);
  });
});
