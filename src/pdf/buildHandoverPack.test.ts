import { PDFDocument } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
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

function pdfVisibleText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const marker = Buffer.from('stream\n');
  const chunks: Buffer[] = [];
  let from = 0;
  while (from < raw.length) {
    const start = raw.indexOf(marker, from);
    if (start < 0) break;
    const end = raw.indexOf(Buffer.from('\nendstream'), start);
    if (end < 0) break;
    try {
      chunks.push(inflateSync(raw.subarray(start + marker.length, end)));
    } catch {
      // Image/other streams can fail inflate; skip them.
    }
    from = end + 1;
  }
  return Buffer.concat(chunks).toString('latin1').replace(/<([0-9A-Fa-f]+)> Tj/g, (_match, hex) => (
    Buffer.from(hex, 'hex').toString('latin1')
  ));
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

  test('cover omits missing facts and does not paint 0 sqm or $0.00', async () => {
    const { bytes } = await buildHandoverPackPdf({
      cover: coverFromProfile({
        jobName: 'Kelly St',
        generatedAt: new Date('2026-08-31T12:00:00+10:00'),
        profile: { businessName: 'Opal SS Constructions' },
      }),
      files: [],
      sources: new Map(),
    });
    const raw = pdfVisibleText(bytes);
    expect(raw).not.toContain('0 sqm');
    expect(raw).not.toContain('$0.00');

    const withFacts = await buildHandoverPackPdf({
      cover: coverFromProfile({
        jobName: 'Kelly St',
        jobAddress: '12 Kelly Street',
        floorArea: '167.22 sqm',
        contractValue: '$321,916.29',
        generatedAt: new Date('2026-08-31T12:00:00+10:00'),
        profile: { businessName: 'Opal SS Constructions' },
      }),
      files: [],
      sources: new Map(),
    });
    const painted = pdfVisibleText(withFacts.bytes);
    expect(painted).toContain('12 Kelly Street');
    expect(painted).toContain('167.22 sqm');
    expect(painted).toContain('$321,916.29');
    expect(painted).not.toContain('0 sqm');
  });
});
