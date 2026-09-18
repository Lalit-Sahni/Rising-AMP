import {
  actorEmailFrom,
  formatRoleProposalTable,
  inLastDays,
  mergeRoleProposals,
  parsePhase18RoleArgs,
  proposeRoleFromActivity,
  type PersonJobActivity,
} from './proposeJobRoles';

function row(over: Partial<PersonJobActivity>): PersonJobActivity {
  return {
    email: 'site@opal.test',
    jobId: 'job-1',
    jobName: '72 Centenary Dr',
    expensesCreated: 0,
    expensesEdited: 0,
    invoices: 0,
    filesUploaded: 0,
    photosUploaded: 0,
    assistantReceipts: 0,
    costPlanChanges: 0,
    costPlanLocks: 0,
    ...over,
  };
}

describe('proposeRoleFromActivity', () => {
  test('expenses and photos are Site', () => {
    expect(proposeRoleFromActivity(row({
      expensesCreated: 4,
      photosUploaded: 2,
      filesUploaded: 2,
    }))).toBe('site');
  });

  test('issued invoices or a locked cost plan are Manager', () => {
    expect(proposeRoleFromActivity(row({ invoices: 1 }))).toBe('manager');
    expect(proposeRoleFromActivity(row({ costPlanLocks: 1 }))).toBe('manager');
  });

  test('no writes in 90 days is a question, never Viewer', () => {
    expect(proposeRoleFromActivity(row({}))).toBe('ask');
  });
});

describe('mergeRoleProposals', () => {
  test('prints one row per person and never proposes viewer', () => {
    const table = mergeRoleProposals([
      row({ email: 'site@opal.test', expensesCreated: 3 }),
      row({ email: 'site@opal.test', jobId: 'job-2', jobName: 'Kelly St', photosUploaded: 1, filesUploaded: 1 }),
      row({ email: 'books@opal.test' }),
      row({ email: 'boss@opal.test', invoices: 2 }),
    ]);
    expect(table.map((line) => line.proposedRole)).toEqual(['ask', 'manager', 'site']);
    expect(table.every((line) => (line.proposedRole as string) !== 'viewer')).toBe(true);
    const printed = formatRoleProposalTable(table);
    expect(printed).toMatch(/books@opal.test/);
    expect(printed).toMatch(/no writes in 90 days/);
    expect(printed).not.toMatch(/\bviewer\b/i);
  });

  test('actor email prefers a stored address, then a uid map', () => {
    const uidToEmail = new Map([['uid-1', 'site@opal.test']]);
    expect(actorEmailFrom({ createdBy: 'uid-1' }, uidToEmail)).toBe('site@opal.test');
    expect(actorEmailFrom({ email: 'Boss@Opal.Test', createdBy: 'uid-1' }, uidToEmail)).toBe('boss@opal.test');
    expect(actorEmailFrom({ uploadedBy: 'uid-missing' }, uidToEmail)).toBeNull();
  });

  test('90-day window', () => {
    const now = new Date('2026-09-18T00:00:00Z');
    expect(inLastDays('2026-08-01T00:00:00Z', now, 90)).toBe(true);
    expect(inLastDays('2026-01-01T00:00:00Z', now, 90)).toBe(false);
  });

  test('refuses production without a second flag and never applies there', () => {
    expect(parsePhase18RoleArgs(['--staging'])).toMatchObject({ apply: false, staging: true });
    expect(() => parsePhase18RoleArgs(['--production'])).toThrow(/i-mean-production/);
    expect(() => parsePhase18RoleArgs(['--apply', '--production', '--i-mean-production']))
      .toThrow(/apply on production/);
    expect(() => parsePhase18RoleArgs(['--apply'])).toThrow(/staging only/);
  });
});
