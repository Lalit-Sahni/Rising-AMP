import { formatCents } from '../money';
import {
  FACT_PREVIOUS_CAP,
  JOB_FACTS_DOC_ID,
  JOB_FACTS_SCHEMA_VERSION,
  applyFactWrite,
  buildConfirmFactPatch,
  buildOwnerFactPatch,
  decideFactWrite,
  formatAreaSqm,
  handoverFactLines,
  jobExportIdentity,
  jobFactsLead,
  jobFactsLeadParts,
  jobFactsPatchSchema,
  jobFactsSchema,
  mergeJobFactsPatch,
  parseJobFacts,
  unconfirmedJobFactCount,
  type FactLike,
  type FactSource,
  type JobFacts,
} from './jobFacts';

const NOW = new Date('2026-09-09T00:00:00Z');

function provenance(source: FactSource, extra: Partial<FactLike> = {}) {
  return {
    source,
    sourceRef: extra.sourceRef ?? null,
    confirmedBy: extra.confirmedBy ?? null,
    confirmedAt: extra.confirmedAt === undefined ? null : extra.confirmedAt,
    updatedAt: extra.updatedAt ?? NOW,
  };
}

function stringFact(value: string, source: FactSource, extra: Partial<FactLike> = {}) {
  return { value, ...provenance(source, extra) };
}

function areaFact(value: number, source: FactSource, extra: Partial<FactLike> = {}) {
  return { value, unit: 'sqm' as const, ...provenance(source, extra) };
}

function centsFact(value: number, source: FactSource, extra: Partial<FactLike> = {}) {
  return { value, ...provenance(source, extra) };
}

function confirmed(extra: Partial<FactLike> = {}) {
  return { confirmedBy: extra.confirmedBy ?? 'owner-1', confirmedAt: extra.confirmedAt ?? NOW };
}

const emptyFacts = {
  jobId: 'job-1',
  schemaVersion: 1 as const,
  updatedAt: NOW,
} satisfies JobFacts;

describe('job facts schema', () => {
  test('an empty facts document is valid and invents no defaults', () => {
    const parsed = jobFactsSchema.parse(emptyFacts);
    expect(parsed.schemaVersion).toBe(JOB_FACTS_SCHEMA_VERSION);
    expect(parsed.jobId).toBe('job-1');
    expect(parsed.floorArea).toBeUndefined();
    expect(parsed.siteArea).toBeUndefined();
    expect(parsed.contractValueCents).toBeUndefined();
    expect(parsed.depositCents).toBeUndefined();
    expect(parsed.storeys).toBeUndefined();
    expect(parsed.address).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(parsed, 'floorArea')).toBe(false);
  });

  test('accepts optional createdAt and createdBy on an otherwise empty record', () => {
    const parsed = jobFactsSchema.parse({
      ...emptyFacts,
      createdBy: 'owner-1',
      createdAt: NOW,
    });
    expect(parsed.createdBy).toBe('owner-1');
    expect(parsed.createdAt).toEqual(NOW);
  });

  test('stores contract money as integer cents, never dollars', () => {
    const parsed = jobFactsSchema.parse({
      ...emptyFacts,
      contractValueCents: centsFact(32_191_629, 'import', { sourceRef: 'file-boq' }),
    });
    expect(parsed.contractValueCents?.value).toBe(32_191_629);
    expect(formatCents(parsed.contractValueCents!.value)).toBe('$321,916.29');
    expect(parseJobFacts({
      ...emptyFacts,
      contractValueCents: centsFact(321916.29 as unknown as number, 'import'),
    }).ok).toBe(false);
    expect(parseJobFacts({
      ...emptyFacts,
      contractValueCents: {
        ...centsFact(32_191_629, 'import'),
        value: '32191629',
      },
    }).ok).toBe(false);
  });

  test('areas are a finite number with unit sqm, never a free-text string', () => {
    const parsed = jobFactsSchema.parse({
      ...emptyFacts,
      floorArea: areaFact(167.22, 'import', { sourceRef: 'file-boq' }),
    });
    expect(parsed.floorArea?.value).toBe(167.22);
    expect(parsed.floorArea?.unit).toBe('sqm');
    expect(parseJobFacts({
      ...emptyFacts,
      floorArea: { ...areaFact(167.22, 'import'), unit: 'm2' },
    }).ok).toBe(false);
    expect(parseJobFacts({
      ...emptyFacts,
      floorArea: stringFact('167.22 sqm', 'import'),
    }).ok).toBe(false);
  });

  test('dates are YYYY-MM-DD like the cost plan baseline', () => {
    const parsed = jobFactsSchema.parse({
      ...emptyFacts,
      siteStart: { value: '2026-09-09', ...provenance('owner') },
    });
    expect(parsed.siteStart?.value).toBe('2026-09-09');
    expect(parseJobFacts({
      ...emptyFacts,
      siteStart: { value: '09/09/2026', ...provenance('owner') },
    }).ok).toBe(false);
  });

  test('rejects extra keys, chat blobs, and a wrong schema version', () => {
    expect(parseJobFacts({ ...emptyFacts, sentence: 'The house is 167 sqm' }).ok).toBe(false);
    expect(parseJobFacts({ ...emptyFacts, messages: [{ role: 'assistant' }] }).ok).toBe(false);
    expect(parseJobFacts({ ...emptyFacts, schemaVersion: 2 }).ok).toBe(false);
    expect(parseJobFacts({ schemaVersion: 1, updatedAt: NOW }).ok).toBe(false);
    expect(jobFactsPatchSchema.safeParse({ sentence: 'nope' }).success).toBe(false);
  });

  test('storeys are non-negative integers and retention is 0–100 as recorded', () => {
    expect(jobFactsSchema.parse({
      ...emptyFacts,
      storeys: centsFact(2, 'owner'),
      retentionPercent: { value: 5, ...provenance('document') },
    }).storeys?.value).toBe(2);
    expect(parseJobFacts({ ...emptyFacts, storeys: centsFact(-1, 'owner') }).ok).toBe(false);
    expect(parseJobFacts({ ...emptyFacts, storeys: { value: 1.5, ...provenance('owner') } }).ok).toBe(false);
    expect(parseJobFacts({
      ...emptyFacts,
      retentionPercent: { value: 101, ...provenance('document') },
    }).ok).toBe(false);
  });

  test('soft history on a field is capped at 20 snapshots', () => {
    const previous = Array.from({ length: FACT_PREVIOUS_CAP }, (_, index) => (
      stringFact(`old-${index}`, 'import')
    ));
    expect(jobFactsSchema.parse({
      ...emptyFacts,
      address: { ...stringFact('now', 'owner'), previous },
    }).address?.previous).toHaveLength(20);
    expect(parseJobFacts({
      ...emptyFacts,
      address: {
        ...stringFact('now', 'owner'),
        previous: [...previous, stringFact('too-old', 'import')],
      },
    }).ok).toBe(false);
  });

  test('doc id current is the versioned-document name, not a stored field', () => {
    expect(JOB_FACTS_DOC_ID).toBe('current');
    expect(jobFactsSchema.parse({ ...emptyFacts, id: JOB_FACTS_DOC_ID }).id).toBe('current');
  });
});

describe('decideFactWrite', () => {
  test('no current → write', () => {
    expect(decideFactWrite(null, stringFact('72 Centenary Dr', 'import'))).toBe('write');
    expect(decideFactWrite(undefined, areaFact(167.22, 'assistant'))).toBe('write');
  });

  test('current unconfirmed → write', () => {
    const current = stringFact('72 Centenary Rd', 'import');
    expect(current.confirmedAt).toBeNull();
    expect(decideFactWrite(current, stringFact('72 Centenary Dr', 'document'))).toBe('write');
  });

  test('current confirmed, same value → keep', () => {
    const current = {
      ...areaFact(167.22, 'import'),
      ...confirmed(),
    };
    expect(decideFactWrite(current, areaFact(167.22, 'assistant'))).toBe('keep');
    expect(decideFactWrite(
      { ...centsFact(32_191_629, 'owner'), ...confirmed() },
      centsFact(32_191_629, 'import'),
    )).toBe('keep');
  });

  test('current confirmed, different value, incoming owner → write', () => {
    const current = {
      ...stringFact('old address', 'import'),
      ...confirmed(),
    };
    expect(decideFactWrite(current, stringFact('72 Centenary Dr', 'owner'))).toBe('write');
  });

  test('current confirmed, different value, incoming not owner → propose', () => {
    const current = {
      ...areaFact(167.22, 'owner'),
      ...confirmed(),
    };
    expect(decideFactWrite(current, areaFact(180, 'import'))).toBe('propose');
    expect(decideFactWrite(current, areaFact(180, 'document'))).toBe('propose');
    expect(decideFactWrite(current, areaFact(180, 'assistant'))).toBe('propose');
  });
});

describe('applyFactWrite and merge', () => {
  test('first write has no previous; a replace pushes the old value, capped at 20', () => {
    const first = applyFactWrite(null, stringFact('one', 'import'));
    expect(first.value).toBe('one');
    expect(first.previous).toBeUndefined();

    const second = applyFactWrite(first, stringFact('two', 'owner'));
    expect(second.value).toBe('two');
    expect(second.previous).toEqual([expect.objectContaining({ value: 'one', source: 'import' })]);
    expect(second.previous?.[0]).not.toHaveProperty('previous');

    let current = second;
    for (let i = 0; i < 25; i += 1) {
      current = applyFactWrite(current, stringFact(`v${i}`, 'owner'));
    }
    expect(current.previous).toHaveLength(FACT_PREVIOUS_CAP);
  });

  test('merge writes unconfirmed fields, keeps confirmed matches, and proposes the rest', () => {
    const current = jobFactsSchema.parse({
      ...emptyFacts,
      address: stringFact('72 Centenary Rd', 'import'),
      floorArea: { ...areaFact(167.22, 'owner'), ...confirmed() },
      contractValueCents: { ...centsFact(1_000_000, 'owner'), ...confirmed() },
    });
    const merged = mergeJobFactsPatch(current, {
      address: stringFact('72 Centenary Dr', 'document'),
      floorArea: areaFact(167.22, 'import'),
      contractValueCents: centsFact(2_000_000, 'import'),
      suburb: stringFact('South Wentworthville', 'owner'),
    }, { jobId: 'job-1', updatedAt: NOW });

    expect(merged.written).toEqual(['address', 'suburb']);
    expect(merged.proposed).toEqual(['contractValueCents']);
    expect(merged.facts.address?.value).toBe('72 Centenary Dr');
    expect(merged.facts.address?.previous?.[0]).toEqual(expect.objectContaining({
      value: '72 Centenary Rd',
      source: 'import',
    }));
    expect(merged.facts.floorArea?.value).toBe(167.22);
    expect(merged.facts.contractValueCents?.value).toBe(1_000_000);
    expect(merged.facts.suburb?.value).toBe('South Wentworthville');
  });

  test('a confirmed field yields to an owner write and keeps history', () => {
    const current = jobFactsSchema.parse({
      ...emptyFacts,
      floorArea: { ...areaFact(167.22, 'import'), ...confirmed() },
    });
    const merged = mergeJobFactsPatch(current, {
      floorArea: { ...areaFact(170, 'owner'), ...confirmed() },
    }, { jobId: 'job-1', updatedAt: NOW });
    expect(merged.written).toEqual(['floorArea']);
    expect(merged.proposed).toEqual([]);
    expect(merged.facts.floorArea?.value).toBe(170);
    expect(merged.facts.floorArea?.source).toBe('owner');
    expect(merged.facts.floorArea?.previous?.[0]).toEqual(expect.objectContaining({
      value: 167.22,
      unit: 'sqm',
    }));
  });

  test('merge of an empty patch onto nothing still does not invent numbers', () => {
    const merged = mergeJobFactsPatch(null, {}, {
      jobId: 'job-1',
      updatedAt: NOW,
      createdBy: 'owner-1',
      createdAt: NOW,
    });
    expect(merged.written).toEqual([]);
    expect(merged.facts.floorArea).toBeUndefined();
    expect(merged.facts.contractValueCents).toBeUndefined();
    expect(merged.facts.createdBy).toBe('owner-1');
  });
});

describe('unconfirmedJobFactCount', () => {
  test('present unconfirmed counts as 1; missing and confirmed are ignored; empty facts are 0', () => {
    expect(unconfirmedJobFactCount(null)).toBe(0);
    expect(unconfirmedJobFactCount(undefined)).toBe(0);
    expect(unconfirmedJobFactCount(emptyFacts)).toBe(0);
    expect(unconfirmedJobFactCount(jobFactsSchema.parse({
      ...emptyFacts,
      floorArea: areaFact(167.22, 'import'),
    }))).toBe(1);
    expect(unconfirmedJobFactCount(jobFactsSchema.parse({
      ...emptyFacts,
      address: stringFact('72 Centenary Dr', 'import'),
      floorArea: { ...areaFact(167.22, 'owner'), ...confirmed() },
    }))).toBe(1);
    expect(unconfirmedJobFactCount(jobFactsSchema.parse({
      ...emptyFacts,
      address: { ...stringFact('72 Centenary Dr', 'owner'), ...confirmed() },
      floorArea: { ...areaFact(167.22, 'owner'), ...confirmed() },
    }))).toBe(0);
  });
});

describe('overview lead and export lines', () => {
  test('omits absent fields and does not repeat an address that is the job name', () => {
    expect(jobFactsLead(null, 'Kelly St')).toEqual({});
    expect(jobFactsLead(emptyFacts, 'Kelly St')).toEqual({});
    expect(jobFactsLeadParts(jobFactsLead(emptyFacts, 'Kelly St'))).toEqual([]);

    const sameAddress = jobFactsSchema.parse({
      ...emptyFacts,
      address: stringFact('Kelly St', 'import'),
      floorArea: areaFact(167.22, 'import'),
      contractValueCents: centsFact(32_191_629, 'document'),
    });
    expect(jobFactsLead(sameAddress, 'Kelly St')).toEqual({
      floorArea: '167.22 sqm',
      contractValue: '$321,916.29',
    });

    const different = jobFactsSchema.parse({
      ...emptyFacts,
      address: stringFact('12 Kelly Street, South Wentworthville', 'import'),
    });
    expect(jobFactsLead(different, 'Kelly St').address).toBe('12 Kelly Street, South Wentworthville');
  });

  test('never invents 0 sqm, $0 or an em dash on the lead', () => {
    const lead = jobFactsLead(emptyFacts, 'Kelly St');
    const painted = JSON.stringify(lead);
    expect(painted).not.toContain('0 sqm');
    expect(painted).not.toContain('$0');
    expect(painted).not.toContain('—');
    expect(formatAreaSqm(0)).toBeNull();
    expect(formatAreaSqm(undefined)).toBeNull();
    expect(jobExportIdentity('Kelly St', emptyFacts)).toEqual({ jobName: 'Kelly St' });
    expect(jobExportIdentity('', null)).toEqual({});
  });
});

describe('owner edit patch', () => {
  test('owner edit patch uses source owner and does not persist empty or 0 sqm', () => {
    const written = buildOwnerFactPatch('floorArea', '167.22', 'uid-1', NOW);
    expect(written.ok).toBe(true);
    if (written.ok) {
      expect(written.patch.floorArea?.source).toBe('owner');
      expect(written.patch.floorArea?.value).toBe(167.22);
      expect(written.patch.floorArea?.unit).toBe('sqm');
      expect(written.patch.floorArea?.confirmedBy).toBe('uid-1');
      expect(written.patch.floorArea?.confirmedAt).toEqual(NOW);
    }
    const money = buildOwnerFactPatch('contractValueCents', '321916.29', 'uid-1', NOW);
    expect(money.ok).toBe(true);
    if (money.ok) {
      expect(money.patch.contractValueCents?.source).toBe('owner');
      expect(money.patch.contractValueCents?.value).toBe(32_191_629);
    }
    expect(buildOwnerFactPatch('address', '   ', 'uid-1', NOW)).toEqual({ ok: false, reason: 'empty' });
    expect(buildOwnerFactPatch('floorArea', '0', 'uid-1', NOW)).toEqual({ ok: false, reason: 'empty' });
    expect(buildOwnerFactPatch('contractValueCents', '0', 'uid-1', NOW)).toEqual({ ok: false, reason: 'empty' });
  });

  test('confirm in place keeps the original source', () => {
    const current = jobFactsSchema.parse({
      ...emptyFacts,
      floorArea: areaFact(167.22, 'import', { sourceRef: 'file-boq' }),
    });
    const confirmedPatch = buildConfirmFactPatch('floorArea', current, 'uid-1', NOW);
    expect(confirmedPatch.ok).toBe(true);
    if (confirmedPatch.ok) {
      expect(confirmedPatch.patch.floorArea?.source).toBe('import');
      expect(confirmedPatch.patch.floorArea?.sourceRef).toBe('file-boq');
      expect(confirmedPatch.patch.floorArea?.value).toBe(167.22);
      expect(confirmedPatch.patch.floorArea?.confirmedBy).toBe('uid-1');
      expect(confirmedPatch.patch.floorArea?.confirmedAt).toEqual(NOW);
    }
  });
});

describe('handover fact lines', () => {
  test('omits missing facts and never paints 0 sqm or $0', () => {
    expect(handoverFactLines(null)).toEqual({});
    expect(handoverFactLines(emptyFacts)).toEqual({});
    const lines = handoverFactLines(jobFactsSchema.parse({
      ...emptyFacts,
      address: stringFact('12 Kelly Street', 'import'),
      floorArea: areaFact(167.22, 'import'),
    }));
    expect(lines.address).toBe('12 Kelly Street');
    expect(lines.floorArea).toBe('167.22 sqm');
    expect(lines.contractValue).toBeUndefined();
    expect(JSON.stringify(lines)).not.toMatch(/0 sqm|\$0\.00|—/);
  });
});
