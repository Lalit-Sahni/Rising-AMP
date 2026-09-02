import {
  QUOTE_FILE_MAX,
  addQuoteFileIds,
  quoteFileIds,
  quoteFilePayload,
  quoteForFileId,
  removeQuoteFileId,
} from './quoteFiles';

describe('quote file pointers', () => {
  test('keeps a leftover single fileId and de-dupes the list', () => {
    expect(quoteFileIds({ fileId: 'a', fileIds: ['a', 'b', 'a'] })).toEqual(['a', 'b']);
    expect(quoteFileIds({ fileId: 'legacy' })).toEqual(['legacy']);
    expect(quoteFileIds({ fileIds: ['one', 'two'] })).toEqual(['one', 'two']);
  });

  test('payload stores the list and mirrors the first id', () => {
    expect(quoteFilePayload(['x', 'y'])).toEqual({ fileId: 'x', fileIds: ['x', 'y'] });
    expect(quoteFilePayload([])).toEqual({ fileId: null, fileIds: [] });
  });

  test('refuses more than the cap instead of silently dropping', () => {
    const current = Array.from({ length: QUOTE_FILE_MAX }, (_, index) => `f${index}`);
    const result = addQuoteFileIds(current, ['another']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/10 files/);
  });

  test('a file belongs to at most one live quote', () => {
    const quotes = [
      { id: 'q1', party: 'Asif', status: 'received', fileIds: ['f1'] },
      { id: 'q2', party: 'Passed', status: 'void', fileId: 'f1' },
    ];
    expect(quoteForFileId(quotes, 'f1')?.id).toBe('q1');
    expect(removeQuoteFileId(['f1', 'f2'], 'f1')).toEqual(['f2']);
  });
});
