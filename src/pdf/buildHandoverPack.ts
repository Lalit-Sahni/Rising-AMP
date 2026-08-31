/** Build a handover PDF in the browser. Loaded only when Generate is tapped. */

import {
  formatHandoverDate,
  handoverEmbedKind,
  missingHandoverTypes,
  sortHandoverFiles,
  unsupportedHandoverReason,
  type HandoverCover,
  type HandoverSkip,
} from '../domain/handoverPack';
import { filesDrawerMeta, formatJobFileDocumentDate } from '../domain/jobFiles';
import type { JobFile } from '../domain/schemas';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 56;
const INK = { r: 28 / 255, g: 30 / 255, b: 35 / 255 };
const SLATE = { r: 86 / 255, g: 91 / 255, b: 100 / 255 };
const WARN = { r: 183 / 255, g: 134 / 255, b: 43 / 255 };
const RULE = { r: 231 / 255, g: 233 / 255, b: 236 / 255 };
const ACCENT = { r: 232 / 255, g: 93 / 255, b: 26 / 255 };

type PdfLib = typeof import('pdf-lib');
type PdfDoc = import('pdf-lib').PDFDocument;
type PdfFont = import('pdf-lib').PDFFont;
type PdfPage = import('pdf-lib').PDFPage;
type PdfRgb = import('pdf-lib').RGB;

function colour(pdf: PdfLib, value: { r: number; g: number; b: number }): PdfRgb {
  return pdf.rgb(value.r, value.g, value.b);
}

function wrapText(font: PdfFont, text: string, size: number, maxWidth: number): string[] {
  const raw = String(text || '').trim();
  if (!raw) return [''];
  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  const flush = () => {
    if (line) lines.push(line);
    line = '';
  };
  const splitLong = (word: string) => {
    let rest = word;
    while (rest) {
      let i = rest.length;
      while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > maxWidth) i -= 1;
      lines.push(rest.slice(0, i));
      rest = rest.slice(i);
    }
  };
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      return;
    }
    flush();
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      return;
    }
    splitLong(word);
  });
  flush();
  return lines.length ? lines : [''];
}

function drawLines(
  page: PdfPage,
  font: PdfFont,
  lines: string[],
  x: number,
  y: number,
  size: number,
  color: PdfRgb,
  gap: number,
): number {
  let cursor = y;
  lines.forEach((line) => {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= gap;
  });
  return cursor;
}

async function rasterToJpeg(bytes: Uint8Array, contentType: string): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    throw new Error('Images can only be packed in the browser');
  }
  const blob = new Blob([bytes], { type: contentType || 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read this image'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, image.naturalWidth || image.width);
    canvas.height = Math.max(1, image.naturalHeight || image.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not read this image');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((next) => {
        if (next) resolve(next);
        else reject(new Error('Could not read this image'));
      }, 'image/jpeg', 0.85);
    });
    return new Uint8Array(await jpeg.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawCover(
  pdf: PdfLib,
  page: PdfPage,
  font: PdfFont,
  bold: PdfFont,
  cover: HandoverCover,
) {
  const ink = colour(pdf, INK);
  const slate = colour(pdf, SLATE);
  const accent = colour(pdf, ACCENT);
  const width = A4_WIDTH - MARGIN * 2;
  let y = A4_HEIGHT - MARGIN;

  page.drawRectangle({
    x: MARGIN,
    y: y - 4,
    width: 36,
    height: 4,
    color: accent,
  });
  y -= 28;
  page.drawText('HANDOVER PACK', {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: slate,
  });
  y -= 36;
  y = drawLines(
    page,
    bold,
    wrapText(bold, cover.jobName, 26, width),
    MARGIN,
    y,
    26,
    ink,
    30,
  );
  y -= 8;
  if (cover.jobAddress) {
    y = drawLines(
      page,
      font,
      wrapText(font, cover.jobAddress, 12, width),
      MARGIN,
      y,
      12,
      slate,
      16,
    );
  }
  y -= 8;
  page.drawText(formatHandoverDate(cover.generatedAt), {
    x: MARGIN,
    y,
    size: 12,
    font,
    color: slate,
  });
  y -= 24;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4_WIDTH - MARGIN, y },
    thickness: 0.6,
    color: colour(pdf, RULE),
  });
  y -= 28;
  page.drawText('Prepared by', {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: slate,
  });
  y -= 18;
  const who = cover.businessName || cover.displayName;
  if (who) {
    y = drawLines(page, bold, wrapText(bold, who, 13, width), MARGIN, y, 13, ink, 17);
  }
  if (cover.businessName && cover.displayName) {
    y = drawLines(page, font, wrapText(font, cover.displayName, 11, width), MARGIN, y, 11, slate, 15);
  }
  if (cover.abn) {
    y = drawLines(page, font, [`ABN ${cover.abn}`], MARGIN, y, 11, slate, 15);
  }
  cover.addressLines.forEach((line) => {
    y = drawLines(page, font, wrapText(font, line, 11, width), MARGIN, y, 11, slate, 15);
  });
  if (cover.mobile) {
    y = drawLines(page, font, [cover.mobile], MARGIN, y, 11, slate, 15);
  }
  if (cover.email) {
    y = drawLines(page, font, [cover.email], MARGIN, y, 11, slate, 15);
  }
  if (!who && !cover.abn && cover.addressLines.length === 0) {
    drawLines(
      page,
      font,
      wrapText(font, 'No business details on the profile yet.', 11, width),
      MARGIN,
      y,
      11,
      slate,
      15,
    );
  }
  page.drawText('RisingAMP', {
    x: MARGIN,
    y: MARGIN,
    size: 9,
    font,
    color: slate,
  });
}

function drawContentsPages(
  pdf: PdfLib,
  pack: PdfDoc,
  font: PdfFont,
  bold: PdfFont,
  included: JobFile[],
  missing: ReturnType<typeof missingHandoverTypes>,
  skipped: HandoverSkip[],
) {
  const ink = colour(pdf, INK);
  const slate = colour(pdf, SLATE);
  const warn = colour(pdf, WARN);
  const width = A4_WIDTH - MARGIN * 2;
  const lineGap = 16;
  const rows: Array<{ text: string; color: PdfRgb; size: number; heading?: boolean }> = [];

  included.forEach((file, index) => {
    const meta = filesDrawerMeta(file.type);
    const date = file.documentDate ? ` (${formatJobFileDocumentDate(file.documentDate)})` : '';
    rows.push({
      text: `${index + 1}. ${meta.label} — ${file.name}${date}`,
      color: ink,
      size: 11,
    });
  });
  if (included.length === 0) {
    rows.push({ text: 'No documents were selected.', color: slate, size: 11 });
  }

  if (missing.length > 0) {
    rows.push({ text: '', color: slate, size: 11 });
    rows.push({ text: 'Not in this pack', color: warn, size: 12, heading: true });
    missing.forEach((type) => {
      rows.push({
        text: `${filesDrawerMeta(type).label} — missing`,
        color: warn,
        size: 11,
      });
    });
  }

  if (skipped.length > 0) {
    rows.push({ text: '', color: slate, size: 11 });
    rows.push({ text: 'Could not include', color: slate, size: 12, heading: true });
    skipped.forEach((row) => {
      rows.push({
        text: `${row.name} — ${row.reason}`,
        color: slate,
        size: 11,
      });
    });
  }

  let page = pack.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN;
  page.drawText('Contents', { x: MARGIN, y, size: 18, font: bold, color: ink });
  y -= 28;

  const newPage = () => {
    page = pack.addPage([A4_WIDTH, A4_HEIGHT]);
    y = A4_HEIGHT - MARGIN;
  };

  rows.forEach((row) => {
    const lines = wrapText(row.heading ? bold : font, row.text, row.size, width);
    const block = Math.max(lineGap, lines.length * (row.size + 4) + 4);
    if (y - block < MARGIN) newPage();
    y = drawLines(page, row.heading ? bold : font, lines, MARGIN, y, row.size, row.color, row.size + 4);
    y -= 6;
  });
}

async function embedImagePage(
  pdf: PdfLib,
  pack: PdfDoc,
  font: PdfFont,
  file: JobFile,
  bytes: Uint8Array,
) {
  const type = String(file.contentType || '').toLowerCase();
  let image;
  try {
    if (type === 'image/png') {
      image = await pack.embedPng(bytes);
    } else if (type === 'image/jpeg' || type === 'image/jpg') {
      image = await pack.embedJpg(bytes);
    } else {
      image = await pack.embedJpg(await rasterToJpeg(bytes, type));
    }
  } catch (error) {
    if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/png') {
      image = await pack.embedJpg(await rasterToJpeg(bytes, type));
    } else {
      throw error;
    }
  }
  const page = pack.addPage([A4_WIDTH, A4_HEIGHT]);
  const caption = 28;
  const boxWidth = A4_WIDTH - MARGIN * 2;
  const boxHeight = A4_HEIGHT - MARGIN * 2 - caption;
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = MARGIN + (boxWidth - width) / 2;
  const y = MARGIN + caption + (boxHeight - height) / 2;
  page.drawImage(image, { x, y, width, height });
  page.drawText(file.name.slice(0, 90), {
    x: MARGIN,
    y: MARGIN,
    size: 9,
    font,
    color: colour(pdf, SLATE),
  });
}

type ReadyPdf = { file: JobFile; kind: 'pdf'; source: PdfDoc };
type ReadyImage = { file: JobFile; kind: 'image'; bytes: Uint8Array };
type ReadyItem = ReadyPdf | ReadyImage;

async function loadPdfSource(pdf: PdfLib, bytes: Uint8Array): Promise<PdfDoc> {
  const source = await pdf.PDFDocument.load(bytes);
  if (source.isEncrypted) {
    throw new Error('This PDF is locked');
  }
  return source;
}

export async function buildHandoverPackPdf(input: {
  cover: HandoverCover;
  files: JobFile[];
  sources: Map<string, Uint8Array>;
}): Promise<{ bytes: Uint8Array; skipped: HandoverSkip[] }> {
  const pdf = await import('pdf-lib');
  const pack = await pdf.PDFDocument.create();
  const font = await pack.embedFont(pdf.StandardFonts.Helvetica);
  const bold = await pack.embedFont(pdf.StandardFonts.HelveticaBold);
  const selected = sortHandoverFiles(input.files);
  const skipped: HandoverSkip[] = [];
  const ready: ReadyItem[] = [];

  for (const file of selected) {
    const kind = handoverEmbedKind(file);
    if (kind === 'unsupported') {
      skipped.push({ name: file.name, reason: unsupportedHandoverReason(file) });
      continue;
    }
    const bytes = file.id ? input.sources.get(file.id) : undefined;
    if (!bytes) {
      skipped.push({ name: file.name, reason: 'Could not download this file.' });
      continue;
    }
    if (kind === 'pdf') {
      try {
        const source = await loadPdfSource(pdf, bytes);
        ready.push({ file, kind: 'pdf', source });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        skipped.push({
          name: file.name,
          reason: /encrypt|locked/i.test(message)
            ? 'This PDF is locked.'
            : 'Could not add this file to the pack.',
        });
      }
      continue;
    }
    ready.push({ file, kind: 'image', bytes });
  }

  const included = ready.map((item) => item.file);
  drawCover(pdf, pack.addPage([A4_WIDTH, A4_HEIGHT]), font, bold, input.cover);
  drawContentsPages(
    pdf,
    pack,
    font,
    bold,
    included,
    missingHandoverTypes(included),
    skipped,
  );

  for (const item of ready) {
    try {
      if (item.kind === 'pdf') {
        const copied = await pack.copyPages(item.source, item.source.getPageIndices());
        copied.forEach((page) => pack.addPage(page));
      } else {
        await embedImagePage(pdf, pack, font, item.file, item.bytes);
      }
    } catch (error) {
      skipped.push({
        name: item.file.name,
        reason: 'Could not add this file to the pack.',
      });
      const page = pack.addPage([A4_WIDTH, A4_HEIGHT]);
      page.drawText(`Could not include: ${item.file.name}`.slice(0, 90), {
        x: MARGIN,
        y: A4_HEIGHT - MARGIN,
        size: 12,
        font,
        color: colour(pdf, SLATE),
      });
    }
  }

  const bytes = await pack.save();
  return { bytes, skipped };
}
