import { formatCents } from '../money';
import {
  FACT_PREVIOUS_CAP,
  JOB_FACTS_DOC_ID,
  JOB_FACTS_SCHEMA_VERSION,
  applyFactWrite,
  decideFactWrite,
  jobFactsPatchSchema,
  jobFactsSchema,
  mergeJobFactsPatch,
  parseJobFacts,
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
