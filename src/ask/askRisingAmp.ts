/**
 * Client wrapper for askRisingAmp. Palette-only: do not import from App.js
 * or PaletteHost. Returns a route. Does not run src/queries/ or compute spend.
 */
import { parseAskCallableResponse, type AskCallableResponse } from './askRoute';

export const ASK_FUNCTION = 'askRisingAmp';

const FIGURE_IN_TEXT = /[$£€¥0-9]/;

function stripFigureField(value: unknown, fallback?: string): string | undefined {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  if (!FIGURE_IN_TEXT.test(text)) return text;
  return fallback;
}

/** Drop model prose that still contains digits so the client never paints them. */
export function stripAskFigures(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const row = data as { choices?: unknown };
  if (!Array.isArray(row.choices)) return data;
  return {
    ...row,
    choices: row.choices.map((choice) => {
      if (!choice || typeof choice !== 'object' || Array.isArray(choice)) return choice;
      const next = { ...(choice as Record<string, unknown>) };
      const sentence = stripFigureField(next.sentence);
      if (sentence) next.sentence = sentence;
      else delete next.sentence;
      if (next.query === 'none') {
        next.reason = stripFigureField(next.reason, 'That cannot be answered from the queries.');
        next.params = {};
      }
      return next;
    }),
  };
}

export function parseAskClientResponse(data: unknown): AskCallableResponse {
  try {
    return parseAskCallableResponse(data);
  } catch {
    return parseAskCallableResponse(stripAskFigures(data));
  }
}

export async function callAskRisingAmp(input: {
  question: string;
  orgId: string;
  jobId?: string | null;
}): Promise<AskCallableResponse> {
  const { callFunction } = await import('../firebase/callable');
  const data = await callFunction(ASK_FUNCTION, {
    question: input.question,
    orgId: input.orgId,
    jobId: input.jobId || undefined,
  }, { timeout: 60000 });
  return parseAskClientResponse(data);
}
