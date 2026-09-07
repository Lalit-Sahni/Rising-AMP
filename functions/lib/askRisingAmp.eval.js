'use strict';

/**
 * Deterministic Ask classifier for CI evals. Not used in production.
 * Production still calls OpenAI; this stand-in feeds the same parseAskRoute
 * path so paraphrases and junk refusals are tested without a live key.
 */
const fixtures = require('./askRisingAmp.eval.json');

const TRADES = [
  ['concreting', /\b(concreting|concrete)\b/i],
  ['carpentry', /\b(carpentry|carpenter)\b/i],
  ['electrical', /\b(electrical|electrician)\b/i],
  ['plumbing', /\b(plumbing|plumber)\b/i],
  ['painting', /\b(painting|painter)\b/i],
];

const PARTIES = [
  ['Metro Consulting', /\bmetro consulting\b/i],
  ['Metro', /\bmetro\b/i],
  ['Bunnings', /\bbunnings\b/i],
  ['Sydney Excavation', /\bsydney excavation\b/i],
  ['Lalit', /\blalit\b/i],
];

const EMPTY_PARAMS = {
  jobId: null,
  tradeId: null,
  trade: null,
  partyId: null,
  party: null,
  category: null,
  status: null,
  type: null,
  text: null,
  from: null,
  to: null,
  period: null,
  olderThanDays: null,
};

function clipText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function noneChoice(reason) {
  return {
    query: 'none',
    params: {},
    sentence: '',
    reason: reason || 'That cannot be answered from the queries.',
  };
}

function stripInjection(text) {
  return clipText(String(text || '')
    .replace(/expense note:\s*/gi, ' ')
    .replace(/file excerpt:\s*/gi, ' ')
    .replace(/\bnote:\s*/gi, ' ')
    .replace(/ignore (all |previous |your )?(instructions|prompt)s?( and)?/gi, ' ')
    .replace(/do not follow (your |these |previous )?(rules|instructions)/gi, ' ')
    .replace(/you are now [^.?!]{0,80}/gi, ' ')
    .replace(/system prompt:\s*/gi, ' '));
}

function isHardRefuse(q) {
  const s = q.toLowerCase();
  if (/\b(will we finish|will this job make|forecast|predict|next quarter spend|next year)\b/.test(s)) {
    return true;
  }
  if (/\b(sue|legal advice|lawyer|solicitor)\b/.test(s)) return true;
  if (/\b(create an expense|void (this |the )?invoice|delete this|code this trade)\b/.test(s)) {
    return true;
  }
  if (/\badd\b.+\band\b.+\btogether\b/.test(s)) return true;
  if (/\b(weather|recipe|football|colour should we paint|color should we paint)\b/.test(s)) {
    return true;
  }
  if (/\b(asdfghjkl|qwerty|banana-xyz|zzzzq)\b/.test(s)) return true;
  return false;
}

function pickTrade(q) {
  for (let i = 0; i < TRADES.length; i += 1) {
    if (TRADES[i][1].test(q)) return TRADES[i][0];
  }
  return '';
}

function pickParty(q) {
  for (let i = 0; i < PARTIES.length; i += 1) {
    if (PARTIES[i][1].test(q)) return PARTIES[i][0];
  }
  return '';
}

function pickCategory(q) {
  const s = q.toLowerCase();
  if (/\blabour\b/.test(s)) return 'labour';
  if (/\bmaterials\b/.test(s)) return 'purchase';
  if (/\bequipment\b/.test(s)) return 'equipment';
  if (/\binvestor\b/.test(s)) return 'investor';
  if (/\bpurchase\b/.test(s)) return 'purchase';
  return '';
}

function pickStatus(q) {
  const s = q.toLowerCase();
  if (/\boverdue\b/.test(s)) return 'overdue';
  if (/\bunpaid\b/.test(s) || /\boutstanding\b/.test(s)) return 'unpaid';
  if (/\bdraft\b/.test(s)) return 'draft';
  if (/\bvoid\b/.test(s)) return 'void';
  if (/\bsent\b/.test(s)) return 'sent';
  if (/\bpaid\b/.test(s)) return 'paid';
  return '';
}

function pickFileType(q) {
  const s = q.toLowerCase();
  if (/\bsite plan\b/.test(s) || (/\bplan\b/.test(s) && !/\bcost plan\b/.test(s))) {
    if (/\bsite plan\b/.test(s)) return 'plan';
  }
  if (/\bpermit\b/.test(s)) return 'permit';
  if (/\bcertificate\b/.test(s)) return 'certificate';
  if (/\bvariation\b/.test(s)) return 'variation';
  if (/\bcontract\b/.test(s)) return 'contract';
  return '';
}

function afterKeyword(q, keyword) {
  const match = String(q).split(new RegExp(keyword, 'i'))[1];
  return clipText(match || '').replace(/[.?!]+$/, '');
}

function spendSignal(q) {
  return /\b(spend|spent|cost|costs|how much)\b/i.test(q);
}

function matchQuery(q) {
  if (/\bquot(e|es|ed)\b/i.test(q)) {
    const trade = pickTrade(q);
    if (trade) {
      return {
        query: 'quotesForTrade',
        params: { tradeId: trade },
        sentence: 'Here are quotes for that trade.',
        reason: '',
      };
    }
  }

  if (/\b(over on|under on|am i over|are we over|are we under|estimate vs|plan vs|plan versus|vs actual|versus spent|versus actual)\b/i.test(q)) {
    const trade = pickTrade(q);
    const params = {};
    if (trade) params.tradeId = trade;
    return {
      query: 'planVsActual',
      params,
      sentence: 'Here is estimate against actual.',
      reason: '',
    };
  }

  if (/\binvoices?\b/i.test(q)) {
    const status = pickStatus(q);
    if (status) {
      return {
        query: 'invoicesByStatus',
        params: { status },
        sentence: 'Here are invoices with that status.',
        reason: '',
      };
    }
  }

  if (/\bfiles mentioning\b/i.test(q)) {
    const text = afterKeyword(q, 'files mentioning');
    const params = {};
    if (text) params.text = text;
    return {
      query: 'findFiles',
      params,
      sentence: 'Here are matching files.',
      reason: '',
    };
  }

  if (
    /\b(where is the |find the |show the |what does the )/i.test(q)
    || /\b(contract|site plan|permit|certificate|variation)\b/i.test(q)
  ) {
    const type = pickFileType(q);
    if (type) {
      return {
        query: 'findFiles',
        params: { type },
        sentence: 'Here is that document.',
        reason: '',
      };
    }
  }

  if (/\b(find expenses|expenses mentioning|expenses for|which expenses|expenses are for)\b/i.test(q)) {
    const party = pickParty(q);
    if (party) {
      return {
        query: 'findExpenses',
        params: { party },
        sentence: 'Here are matching expenses.',
        reason: '',
      };
    }
    const text = afterKeyword(q, 'mentioning');
    const params = {};
    if (text) params.text = text;
    return {
      query: 'findExpenses',
      params,
      sentence: 'Here are matching expenses.',
      reason: '',
    };
  }

  const category = pickCategory(q);
  if (category && spendSignal(q)) {
    return {
      query: 'spendByCategory',
      params: { category },
      sentence: 'Here is spend for that category.',
      reason: '',
    };
  }

  const party = pickParty(q);
  if (party && /\b(paid|spend|spent|how much)\b/i.test(q)) {
    return {
      query: 'spendByParty',
      params: { party },
      sentence: 'Here is spend for that party.',
      reason: '',
    };
  }

  const trade = pickTrade(q);
  if (trade && spendSignal(q)) {
    return {
      query: 'spendByTrade',
      params: { tradeId: trade },
      sentence: 'Here is spend for that trade.',
      reason: '',
    };
  }

  if (/\b(every organisation|every organization|every company|another org|other org|another organisation)\b/i.test(q)) {
    return null;
  }
  if (/\b(portfolio|all the jobs|all jobs|across every job|how are all)\b/i.test(q)) {
    return {
      query: 'portfolioSummary',
      params: {},
      sentence: 'Here is how every job is going.',
      reason: '',
    };
  }

  if (/\b(how is this job|how is the job going|job summary|cost to date on this job)\b/i.test(q)) {
    return {
      query: 'jobSummary',
      params: {},
      sentence: 'Here is how this job is going.',
      reason: '',
    };
  }

  return null;
}

function classifyAskQuestion(question) {
  const original = clipText(question);
  if (!original) return noneChoice('The question is empty.');
  if (isHardRefuse(original)) return noneChoice('That cannot be answered from the queries.');

  const stripped = stripInjection(original) || original;
  if (!stripped) return noneChoice('That cannot be answered from the queries.');
  if (isHardRefuse(stripped)) return noneChoice('That cannot be answered from the queries.');

  const hit = matchQuery(stripped);
  if (hit) return hit;
  return noneChoice('That cannot be answered from the queries.');
}

function toModelJson(choice) {
  const params = { ...EMPTY_PARAMS };
  Object.keys(choice.params || {}).forEach((key) => {
    if (choice.params[key] != null && choice.params[key] !== '') {
      params[key] = choice.params[key];
    }
  });
  const query = choice.query === 'none' ? 'none' : choice.query;
  return {
    choices: [{
      query,
      params: query === 'none' ? EMPTY_PARAMS : params,
      sentence: query === 'none' ? '' : (choice.sentence || 'Here is that answer.'),
      reason: query === 'none' ? (choice.reason || 'That cannot be answered from the queries.') : '',
    }],
  };
}

function evalCounts(rows) {
  const list = rows || fixtures;
  const byQuery = {};
  list.forEach((row) => {
    byQuery[row.expectedQuery] = (byQuery[row.expectedQuery] || 0) + 1;
  });
  return {
    total: list.length,
    none: byQuery.none || 0,
    byQuery,
  };
}

module.exports = {
  classifyAskQuestion,
  evalCounts,
  fixtures,
  stripInjection,
  toModelJson,
};
