import {
  BOOT_CACHE_IS_PAINT_ONLY,
  arraysAfterRemovingEmail,
  canManageJob,
  canReadJob,
  canWriteJob,
  expandRoleEmails,
  resolveJobRole,
  roleArraysForChange,
} from './jobRole';

const owner = 'Owner.Name@gmail.com';
const site = 'site@opal.test';
const manager = 'manager@opal.test';
const viewer = 'viewer@opal.test';

describe('resolveJobRole', () => {
  test('owner wins even when also listed as a manager', () => {
    expect(resolveJobRole({
      email: 'ownername@gmail.com',
      ownerEmail: owner,
      invitedEmails: ['ownername@gmail.com', 'owner.name@gmail.com', manager],
      managers: [owner, manager],
      viewers: [],
    })).toBe('owner');
  });

  test('managers, viewers, site, and nobody', () => {
    const lists = {
      ownerEmail: owner,
      invitedEmails: [owner, manager, viewer, site],
      managers: [manager],
      viewers: [viewer],
    };
    expect(resolveJobRole({ ...lists, email: manager })).toBe('manager');
    expect(resolveJobRole({ ...lists, email: viewer })).toBe('viewer');
    expect(resolveJobRole({ ...lists, email: site })).toBe('site');
    expect(resolveJobRole({ ...lists, email: 'stranger@example.com' })).toBeNull();
  });

  test('missing managers and viewers means Site for anyone invited', () => {
    expect(resolveJobRole({
      email: site,
      ownerEmail: owner,
      invitedEmails: [owner, site],
    })).toBe('site');
  });

  test('in both managers and viewers displays as Site, never that write', () => {
    const dual = {
      email: manager,
      ownerEmail: owner,
      invitedEmails: [owner, manager],
      managers: [manager],
      viewers: [manager],
    };
    expect(resolveJobRole(dual)).toBe('site');
    expect(canWriteJob(dual)).toBe(true);
    expect(canManageJob(dual)).toBe(false);
    const cleaned = roleArraysForChange({
      invitedEmails: dual.invitedEmails,
      managers: dual.managers,
      viewers: dual.viewers,
      ownerEmail: owner,
    });
    expect(cleaned.managers).toEqual([]);
    expect(cleaned.viewers).toEqual([]);
  });
});

describe('permission helpers', () => {
  test('viewer can read and cannot write; site can write and cannot manage', () => {
    const viewerInput = {
      email: viewer,
      ownerEmail: owner,
      invitedEmails: [owner, viewer],
      viewers: [viewer],
    };
    const siteInput = {
      email: site,
      ownerEmail: owner,
      invitedEmails: [owner, site],
    };
    expect(canReadJob(viewerInput)).toBe(true);
    expect(canWriteJob(viewerInput)).toBe(false);
    expect(canManageJob(viewerInput)).toBe(false);
    expect(canWriteJob(siteInput)).toBe(true);
    expect(canManageJob(siteInput)).toBe(false);
    expect(canManageJob({ ...siteInput, email: owner })).toBe(true);
  });

  test('cached role is paint only', () => {
    expect(BOOT_CACHE_IS_PAINT_ONLY).toBe(true);
  });
});

describe('roleArraysForChange', () => {
  test('stores both Gmail spellings and keeps the owner off viewers', () => {
    const next = roleArraysForChange({
      invitedEmails: [owner, 'Lalit.Sahni@gmail.com', viewer],
      managers: ['Lalit.Sahni@gmail.com'],
      viewers: [owner, viewer],
      ownerEmail: owner,
    });
    expect(next.invitedEmails).toEqual(expect.arrayContaining([
      'owner.name@gmail.com',
      'ownername@gmail.com',
      'lalit.sahni@gmail.com',
      'lalitsahni@gmail.com',
      viewer,
    ]));
    expect(next.viewers).toEqual(expect.arrayContaining([viewer]));
    expect(next.viewers.some((email) => email.startsWith('owner'))).toBe(false);
    expect(expandRoleEmails('Lalit.Sahni@gmail.com')).toEqual([
      'lalit.sahni@gmail.com',
      'lalitsahni@gmail.com',
    ]);
  });

  test('drops role emails that are not on the job', () => {
    const next = roleArraysForChange({
      invitedEmails: [owner, site],
      managers: [manager],
      viewers: [viewer],
      ownerEmail: owner,
    });
    expect(next.managers).toEqual([]);
    expect(next.viewers).toEqual([]);
  });

  test('removing a person strips both spellings from every array', () => {
    const next = arraysAfterRemovingEmail({
      invitedEmails: ['Lalit.Sahni@gmail.com', 'lalitsahni@gmail.com', owner, site],
      managers: ['lalitsahni@gmail.com'],
      viewers: ['lalit.sahni@gmail.com'],
      email: 'Lalit.Sahni@gmail.com',
      ownerEmail: owner,
    });
    expect(next.removed).toEqual(['lalit.sahni@gmail.com', 'lalitsahni@gmail.com']);
    expect(next.invitedEmails).not.toEqual(expect.arrayContaining(['lalit.sahni@gmail.com']));
    expect(next.managers).toEqual([]);
    expect(next.viewers).toEqual([]);
    expect(next.invitedEmails.some((email) => email.startsWith('owner'))).toBe(true);
  });

  test('cannot shape a write that removes the owner', () => {
    const next = arraysAfterRemovingEmail({
      invitedEmails: [owner, site],
      managers: [owner],
      viewers: [],
      email: owner,
      ownerEmail: owner,
    });
    expect(next.removed).toEqual([]);
    expect(next.invitedEmails.length).toBeGreaterThan(0);
  });
});
