/**
 * Paint a stored Ask row from the routed choice + query snapshot.
 * Amounts are formatCents on stored cents, never model prose.
 */
import {
  asAskedAt,
  type AskHistoryChoice,
  type AskHistoryQuery,
  type AskHistoryRow,
  type AskHistorySnapshot,
} from '../../domain/askHistory';
import { copyForRefusal } from '../../domain/askRefusal';
import { JOB_FACT_FIELD_LABELS, type JobFactFieldName } from '../../domain/jobFacts';
import { formatCents } from '../../money';
import {
  INCOMPLETE_CAP_MESSAGE,
  REFUSAL_TITLE,
  workingFromProvenance,
  type KnownFigure,
  type RoutedPaletteItem,
} from './answers';

function countLabel(query: AskHistoryQuery, count: number): string {
  if (query === 'invoicesByStatus') return `${count} invoice${count === 1 ? '' : 's'}`;
  if (query === 'findFiles' || query === 'answerFromDocuments') {
    return query === 'answerFromDocuments'
      ? `${count} passage${count === 1 ? '' : 's'}`
      : `${count} file${count === 1 ? '' : 's'}`;
  }
  if (query === 'findExpenses') return `${count} expense${count === 1 ? '' : 's'}`;
  if (query === 'quotesForTrade') return `${count} quote${count === 1 ? '' : 's'}`;
  if (query === 'jobFacts') return `${count} fact${count === 1 ? '' : 's'}`;
  return `${count}`;
}

export function formatAskWhen(date: Date, now = new Date()): string {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((today - start) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) {
    return new Intl.DateTimeFormat('en-AU', { weekday: 'short' }).format(date);
  }
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(date);
}

export function historyFigure(snapshot: AskHistorySnapshot | undefined, query: AskHistoryQuery): string | null {
  if (!snapshot) return null;
  if (snapshot.capped) return 'incomplete';
  if (typeof snapshot.cents === 'number') return formatCents(snapshot.cents);
  if (query === 'findFiles' && (snapshot.count === 0 || snapshot.count == null)) return 'not on file';
  if (query === 'answerFromDocuments' && (snapshot.count === 0 || snapshot.count == null)) {
    return 'no passage';
  }
  if (typeof snapshot.count === 'number') return countLabel(query, snapshot.count);
  return null;
}

export function historySubtitle(row: AskHistoryRow, now = new Date()): string {
  const choice = row.choices[0];
  const bits = [formatAskWhen(asAskedAt(row.askedAt), now)];
  if (row.jobLabel) bits.push(row.jobLabel);
  const figure = historyFigure(choice?.snapshot, choice?.query || 'none');
  if (figure) bits.push(figure);
  return bits.join(' · ');
}

function choiceTitle(choice: AskHistoryChoice): string {
  if (choice.query === 'jobFacts' && choice.params.field) {
    return JOB_FACT_FIELD_LABELS[choice.params.field as JobFactFieldName] || 'Job details';
  }
  return choice.params.trade
    || choice.params.party
    || choice.params.category
    || choice.params.status
    || (choice.query === 'findFiles' ? 'Files' : choice.query === 'answerFromDocuments' ? 'Document' : 'Cost to date');
}

function knownFromSnapshot(snapshot: AskHistorySnapshot | undefined): KnownFigure[] | undefined {
  if (!snapshot) return undefined;
  const known: KnownFigure[] = [];
  if (typeof snapshot.planCents === 'number') {
    known.push({ label: 'Estimated', amount: formatCents(snapshot.planCents) });
  }
  if (typeof snapshot.actualCents === 'number') {
    known.push({ label: 'Spent', amount: formatCents(snapshot.actualCents) });
  } else if (typeof snapshot.cents === 'number' && snapshot.planCents == null) {
    known.push({ label: 'Cost to date', amount: formatCents(snapshot.cents) });
  }
  return known.length ? known : undefined;
}

export function itemsFromAskHistory(row: AskHistoryRow): RoutedPaletteItem[] {
  return row.choices.map((choice, index) => itemFromHistoryChoice(choice, row, index));
}

function itemFromHistoryChoice(
  choice: AskHistoryChoice,
  row: AskHistoryRow,
  index: number,
): RoutedPaletteItem {
  const id = `history:${row.id || 'row'}:${index}`;
  const working = choice.provenance
    ? workingFromProvenance(choice.provenance, {
      job: row.jobLabel || undefined,
      trade: choice.params.trade,
    })
    : undefined;
  const hidden = Boolean(choice.snapshot?.capped) || typeof choice.snapshot?.cents !== 'number';
  const amount = hidden ? '—' : formatCents(choice.snapshot?.cents as number);
  const incomplete = choice.snapshot?.capped ? INCOMPLETE_CAP_MESSAGE : undefined;

  if (choice.refusalReason) {
    const copy = copyForRefusal({
      reason: choice.refusalReason,
      question: row.question,
      tradeName: choice.params.trade || choice.params.tradeId,
      fileType: choice.params.type,
      hasKnownFigures: Boolean(knownFromSnapshot(choice.snapshot)?.length)
        && choice.refusalReason === 'out_of_scope',
      field: choice.params.field,
    });
    const known = choice.refusalReason === 'out_of_scope'
      ? knownFromSnapshot(choice.snapshot)
      : choice.refusalReason === 'nothing_coded' && typeof choice.snapshot?.planCents === 'number'
        ? [{ label: 'Estimated', amount: formatCents(choice.snapshot.planCents) }]
        : undefined;
    return {
      kind: 'none',
      answer: {
        id,
        section: 'Answers',
        kind: 'none',
        title: copy.title,
        detail: copy.detail,
        refusalReason: choice.refusalReason,
        actionNote: copy.actionNote,
        known,
        working,
        incomplete,
        uncoded: {
          count: choice.snapshot?.uncodedCount || 0,
          cents: choice.snapshot?.uncodedCents || 0,
        },
        affected: choice.refusalReason === 'nothing_coded'
          || Boolean((choice.snapshot?.uncodedCents || 0) > 0 || (choice.snapshot?.uncodedCount || 0) > 0),
      },
    };
  }

  if (choice.query === 'none') {
    return {
      kind: 'none',
      answer: {
        id,
        section: 'Answers',
        kind: 'none',
        title: REFUSAL_TITLE,
        detail: 'That cannot be answered from the queries.',
        known: knownFromSnapshot(choice.snapshot),
        working,
        incomplete,
      },
    };
  }

  if (choice.query === 'jobFacts') {
    if (typeof choice.snapshot?.cents === 'number' && !choice.snapshot.capped) {
      return {
        kind: 'fact',
        answer: {
          id,
          section: 'Answers',
          kind: 'fact',
          title: formatCents(choice.snapshot.cents),
          detail: choiceTitle(choice),
          field: (choice.params.field || 'contractValueCents') as JobFactFieldName,
          working,
        },
      };
    }
    return {
      kind: 'fact',
      answer: {
        id,
        section: 'Answers',
        kind: 'fact',
        title: choiceTitle(choice),
        detail: historyFigure(choice.snapshot, choice.query) || 'Recorded on this job.',
        field: (choice.params.field || 'address') as JobFactFieldName,
        working,
      },
    };
  }

  if (
    choice.query === 'invoicesByStatus'
    || choice.query === 'findFiles'
    || choice.query === 'answerFromDocuments'
    || choice.query === 'findExpenses'
    || choice.query === 'quotesForTrade'
  ) {
    if (typeof choice.snapshot?.cents === 'number' && !choice.snapshot.capped) {
      return {
        kind: 'portfolio',
        answer: {
          id,
          section: 'Answers',
          kind: 'portfolio',
          title: choiceTitle(choice),
          amount: formatCents(choice.snapshot.cents),
          detail: historyFigure(choice.snapshot, choice.query) || row.jobLabel || '',
          working,
        },
      };
    }
    return {
      kind: 'none',
      answer: {
        id,
        section: 'Answers',
        kind: 'none',
        title: choiceTitle(choice),
        detail: historyFigure(choice.snapshot, choice.query) || 'No matching rows were stored.',
        working,
        incomplete,
      },
    };
  }

  if (choice.query === 'jobSummary' || choice.query === 'portfolioSummary') {
    return {
      kind: 'portfolio',
      answer: {
        id,
        section: 'Answers',
        kind: 'portfolio',
        title: 'Cost to date',
        amount,
        detail: row.jobLabel || (hidden ? 'On this job' : amount),
        working,
        incomplete,
      },
    };
  }

  return {
    kind: 'spend',
    answer: {
      id,
      section: 'Answers',
      kind: 'spend',
      title: choiceTitle(choice),
      amount,
      detail: [row.jobLabel, typeof choice.snapshot?.count === 'number' ? countLabel(choice.query, choice.snapshot.count) : null]
        .filter(Boolean)
        .join(' · ') || (hidden ? 'On this job' : amount),
      tradeId: String(choice.params.tradeId || ''),
      uncoded: {
        count: choice.snapshot?.uncodedCount || 0,
        cents: choice.snapshot?.uncodedCents || 0,
      },
      affected: Boolean((choice.snapshot?.uncodedCents || 0) > 0 || (choice.snapshot?.uncodedCount || 0) > 0),
      working,
      incomplete,
    },
  };
}
