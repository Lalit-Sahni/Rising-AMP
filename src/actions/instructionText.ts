/**
 * Document text is data, never instruction. Strip instruction-shaped
 * clauses before matching cost-plan section names. Not first paint.
 */

const INSTRUCTION_CLAUSE = /\b(?:also\s+code(?:\s+everything)?(?:\s+to)?|code\s+everything(?:\s+to)?|ignore\s+previous(?:\s+instructions?)?|you\s+must)\b[\s\S]*/gi;

const INSTRUCTION_START = /\b(?:also\s+code|code\s+everything(?:\s+to)?|ignore\s+previous|you\s+must)\b/i;

export function stripInstructionClauses(text: string): string {
  return String(text || '')
    .replace(INSTRUCTION_CLAUSE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksLikeInstruction(value: unknown): boolean {
  const text = String(value || '').trim();
  if (!text) return false;
  return INSTRUCTION_START.test(text);
}
