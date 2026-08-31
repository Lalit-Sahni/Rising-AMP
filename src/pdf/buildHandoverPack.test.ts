import { PDFDocument } from 'pdf-lib';
import { jobFileSchema } from '../domain/schemas';
import { coverFromProfile } from '../domain/handoverPack';
import { buildHandoverPackPdf } from './buildHandoverPack';

function file(overrides: Record<string, unknown> = {}) {
  return jobFileSchema.parse({
    id: 'f1',
    name: 'Permit',
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

const cover = coverFromProfile({
  jobName: '72 Centenary Dr',
  jobAddress: '72 Centenary Dr, Kellyville',
  generatedAt: new Date('2026-08-31T12:00:00+10:00'),
  profile: { businessName: 'Opal SS Constructions', displayName: 'Lalit Sahni', abn: '12 345 678 901' },
});

async function onePagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  return doc.save();
}

describe('handover pack PDF', () => {
  test('cover and contents exist even when nothing is selected, so missing types are named', async () => {
    const { bytes } = await buildHandoverPackPdf({
      cover,
      files: [],
      sources: new Map(),
    });
    const pack = await PDFDocument.load(bytes);
    expect(pack.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  test('appends a selected PDF after the cover and contents', async () => {
    const source = await onePagePdf();
    const permit = file();
    const { bytes, skipped } = await buildHandoverPackPdf({
      cover,
      files: [permit],
      sources: new Map([['f1', source]]),
    });
    expect(skipped).toEqual([]);
    const pack = await PDFDocument.load(bytes);
    expect(pack.getPageCount()).toBe(3);
  });

  test('names Word documents as not included instead of dropping them silently', async () => {
    const word = file({
      id: 'w1',
      name: 'Spec.docx',
      type: 'other',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storagePath: 'files/org/job/w1/spec.docx',
    });
    const { bytes, skipped } = await buildHandoverPackPdf({
      cover,
      files: [word],
      sources: new Map([['w1', new Uint8Array([1, 2, 3])]]),
    });
    expect(skipped.some((row) => /Spec/.test(row.name))).toBe(true);
    const pack = await PDFDocument.load(bytes);
    expect(pack.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
