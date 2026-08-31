import { jobFileSchema } from './schemas';
import {
  defaultHandoverSelectedIds,
  handoverCandidates,
  handoverEmbedKind,
  handoverPackFileName,
  missingHandoverTypes,
  sortHandoverFiles,
  coverFromProfile,
  jobAddressFromClients,
  builderAddressLines,
} from './handoverPack';

function file(overrides: Record<string, unknown> = {}) {
  return jobFileSchema.parse({
    id: 'f1',
    name: 'Doc',
    type: 'permit',
    storagePath: 'files/org/job/f1/doc.pdf',
    thumbnailPath: null,
    contentType: 'application/pdf',
    sizeBytes: 1000,
    uploadedBy: 'owner-1',
    uploadedAt: '2026-08-20',
    documentDate: '2026-03-14',
    status: 'active',
    ...overrides,
  });
}

describe('handover pack selection', () => {
  test('defaults on contract, variation, plan, permit and certificate', () => {
    const files = [
      file({ id: 'c', type: 'contract', name: 'HIA', storagePath: 'files/org/job/c/hia.pdf' }),
      file({ id: 'p', type: 'photo', name: 'Site', contentType: 'image/jpeg', storagePath: 'files/org/job/p/site.jpg' }),
      file({ id: 'o', type: 'other', name: 'Scan', storagePath: 'files/org/job/o/scan.pdf' }),
    ];
    expect(defaultHandoverSelectedIds(files)).toEqual(['c']);
  });

  test('archived files and receipts-as-files are not candidates', () => {
    const files = [
      file({ id: 'gone', status: 'archived', storagePath: 'files/org/job/gone/x.pdf' }),
      file({ id: 'ok', type: 'certificate', name: 'Slab', storagePath: 'files/org/job/ok/slab.pdf' }),
    ];
    expect(handoverCandidates(files).map((row) => row.id)).toEqual(['ok']);
  });

  test('missing types are the expected ones with nothing selected, not a guess about termites', () => {
    expect(missingHandoverTypes([])).toEqual(['contract', 'plan', 'permit', 'certificate']);
    expect(missingHandoverTypes([file({ type: 'certificate' })])).toEqual(['contract', 'plan', 'permit']);
    expect(missingHandoverTypes([file({ type: 'variation' })])).toEqual(['contract', 'plan', 'permit', 'certificate']);
  });

  test('sorts default types first, newest document date within a type', () => {
    const sorted = sortHandoverFiles([
      file({ id: 'p-old', type: 'permit', documentDate: '2025-01-01', storagePath: 'files/org/job/p-old/a.pdf' }),
      file({ id: 'c', type: 'contract', documentDate: '2024-01-01', storagePath: 'files/org/job/c/a.pdf' }),
      file({ id: 'p-new', type: 'permit', documentDate: '2026-06-01', storagePath: 'files/org/job/p-new/a.pdf' }),
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['c', 'p-new', 'p-old']);
  });

  test('only PDFs and photos can be embedded', () => {
    expect(handoverEmbedKind({ contentType: 'application/pdf' })).toBe('pdf');
    expect(handoverEmbedKind({ contentType: 'image/jpeg' })).toBe('image');
    expect(handoverEmbedKind({
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })).toBe('unsupported');
  });

  test('names the downloaded pack after the job and the day', () => {
    expect(handoverPackFileName('72 Centenary Dr', new Date('2026-08-31T12:00:00+10:00'))).toBe(
      'Handover pack — 72 Centenary Dr — 31 Aug 2026.pdf',
    );
  });

  test('cover uses the client address and omits blank builder lines', () => {
    expect(jobAddressFromClients([
      { status: 'void', address: 'Old place' },
      { email: 'owner@example.com', address: '72 Centenary Dr, Kellyville' },
    ])).toBe('72 Centenary Dr, Kellyville');
    expect(builderAddressLines({ street: '1 Builder St', suburb: 'Parramatta', state: 'NSW', postcode: '2150' })).toEqual([
      '1 Builder St',
      'Parramatta NSW 2150',
    ]);
    const cover = coverFromProfile({
      jobName: '72 Centenary Dr',
      profile: { displayName: 'Lalit Sahni', businessName: 'Opal SS Constructions', abn: '12 345' },
    });
    expect(cover.businessName).toBe('Opal SS Constructions');
    expect(cover.addressLines).toEqual([]);
  });
});
