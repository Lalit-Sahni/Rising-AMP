import { callFunction, getFirebaseStorage } from './callable';
import { fileToCompressedBase64 } from './readReceipt';
import {
  isQuoteReadableFile,
  sanitizeQuoteRead,
  type QuoteReadResult,
} from '../domain/quoteRead';

export const QUOTE_READ_MAX_BASE64 = 3.5 * 1024 * 1024;
export const QUOTE_READ_DOWNLOAD_MAX = 8 * 1024 * 1024;

type NamedTrade = { id: string; name?: string; status?: string };

export function isQuoteReadUnavailable(error: unknown): boolean {
  const code = error && typeof error === 'object' ? String((error as { code?: string }).code || '') : '';
  return code === 'functions/not-found'
    || code === 'functions/unavailable'
    || code === 'functions/failed-precondition'
    || code === 'functions/internal'
    || code === 'internal';
}

export function friendlyQuoteReadError(error: unknown): string {
  const code = error && typeof error === 'object' ? String((error as { code?: string }).code || '') : '';
  const message = error instanceof Error ? error.message : '';
  if (code === 'functions/unauthenticated') return 'Sign in again to read this quote.';
  if (code === 'functions/permission-denied') return 'You are not on this organisation.';
  if (code === 'functions/invalid-argument' && message) return message.replace(/^FirebaseError:\s*/i, '');
  if (isQuoteReadUnavailable(error)) {
    return 'Quote reading is not on this environment yet. Attach the file and type the details.';
  }
  if (code === 'functions/deadline-exceeded') {
    return 'Reading timed out. Photograph the page with the total, or type the details.';
  }
  if (message) return message;
  return 'Could not read that quote. Photograph the page with the total, or type the details.';
}

function clipName(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function tradePayload(trades: NamedTrade[] = []) {
  return (trades || [])
    .filter((trade) => trade && trade.id && trade.status !== 'archived')
    .slice(0, 40)
    .map((trade) => ({
      id: String(trade.id),
      name: clipName(trade.name) || String(trade.id),
    }));
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function assertBase64Fits(base64: string) {
  if (base64.length > QUOTE_READ_MAX_BASE64) {
    throw new Error('That file is too large to read. Photograph the page with the total.');
  }
}

export async function readQuoteFromFile(
  file: File,
  trades: NamedTrade[] = [],
): Promise<QuoteReadResult> {
  if (!isQuoteReadableFile(file)) {
    throw new Error('AI can read a photo or a PDF. Photograph the quote, or attach a PDF.');
  }
  const type = String(file.type || '').toLowerCase();
  const pdf = type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf');
  const tradesPayload = tradePayload(trades);
  let payload: Record<string, unknown>;
  if (pdf) {
    if (file.size > QUOTE_READ_DOWNLOAD_MAX) {
      throw new Error('That PDF is too large to read. Photograph the page with the total.');
    }
    const fileBase64 = await fileToBase64(file);
    assertBase64Fits(fileBase64);
    payload = {
      fileBase64,
      mimeType: 'application/pdf',
      fileName: clipName(file.name) || 'quote.pdf',
      trades: tradesPayload,
    };
  } else {
    let compressed;
    try {
      compressed = await fileToCompressedBase64(file);
    } catch {
      throw new Error('Could not read that photo. Try a JPG, or photograph the quote.');
    }
    assertBase64Fits(compressed.imageBase64);
    payload = {
      imageBase64: compressed.imageBase64,
      mimeType: compressed.mimeType || 'image/jpeg',
      fileName: clipName(file.name) || 'quote.jpg',
      trades: tradesPayload,
    };
  }
  const result = await callFunction('readQuoteFile', payload, { timeout: 60000 });
  return sanitizeQuoteRead(result, trades);
}

export async function readQuoteFromStorage(input: {
  storagePath: string;
  contentType?: string;
  name?: string;
  sizeBytes?: number;
  trades?: NamedTrade[];
}): Promise<QuoteReadResult> {
  const contentType = String(input.contentType || '').toLowerCase();
  const name = String(input.name || 'quote');
  const probe = { name, type: contentType };
  if (!isQuoteReadableFile(probe)) {
    throw new Error('AI can read a photo or a PDF. Photograph the quote, or attach a PDF.');
  }
  if (input.sizeBytes && input.sizeBytes > QUOTE_READ_DOWNLOAD_MAX) {
    throw new Error('That file is too large to read. Photograph the page with the total.');
  }
  const storage = await getFirebaseStorage();
  const { ref, getBytes } = await import('firebase/storage');
  const bytes = await getBytes(ref(storage, input.storagePath), QUOTE_READ_DOWNLOAD_MAX);
  const file = new File([bytes], name, { type: contentType || 'application/octet-stream' });
  return readQuoteFromFile(file, input.trades || []);
}
