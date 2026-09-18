import { toPublicProfile } from '../firebase/profileGate';
import {
  arraysAfterAssigningRole,
  buildPeopleRows,
  canActorSetRole,
  confirmOrgRemove,
  filterPeopleByJob,
  mapPersonPublicCard,
  peopleSearchFromString,
  personPanelModel,
  planOrgRemove,
  planRoleChange,
  roleControlDisabled,
  strongestJobRole,
} from './peoplePage';

const NOW = new Date('2026-09-18T12:00:00Z');
const owner = 'sahni.lalit18@gmail.com';
const manager = 'prabh@opal.test';
const site = 'ravi.kumar.site@gmail.com';
const viewer = 'megan@tranco.test';
const otherSite = 'deepak@opal.test';

const jobs = [
  {
    projectId: 'job-tahmoor',
    name: '95 Tahmoor Rd',
    invitedEmails: [owner, manager, site],
    managers: [manager],
    viewers: [],
  },
  {
    projectId: 'job-kelly',
    name: 'Kelly St',
    invitedEmails: [owner, manager, otherSite, viewer],
    managers: [manager],
    viewers: [viewer],
  },
  {
    projectId: 'job-centenary',
    name: '72 Centenary Dr',
    invitedEmails: [owner, otherSite],
    managers: [],
    viewers: [],
  },
];

const profiles = [
  { email: owner, signedIn: true, card: { uid: 'u-ls', email: owner, displayName: 'Lalit Sahni', photoUrl: '' }, updatedAt: new Date('2026-09-18T11:50:00Z') },
  { email: manager, signedIn: true, card: { uid: 'u-pj', email: manager, displayName: 'Prabhsharan Jabbal', photoUrl: '' }, updatedAt: new Date('2026-09-18T10:00:00Z') },
  { email: otherSite, signedIn: true, card: { uid: 'u-ds', email: otherSite, displayName: 'Deepak Sharma', photoUrl: '' }, updatedAt: new Date('2026-09-17T12:00:00Z') },
  { email: viewer, signedIn: true, card: { uid: 'u-mt', email: viewer, displayName: 'Megan Tran', photoUrl: '' }, updatedAt: new Date('2026-09-14T12:00:00Z') },
  { email: site, signedIn: false, card: null, updatedAt: null },
];

function rows() {
  return buildPeopleRows({
    jobs,
    ownerEmail: owner,
    profiles,
    invites: [
      {
        id: 'inv-ravi',
        to: site,
        invitedBy: owner,
        via: 'resend',
        status: 'sent',
        sentAt: new Date('2026-09-09T12:00:00Z'),
      },
    ],
    now: NOW,
  });
}

describe('mapPersonPublicCard', () => {
  test('strips mobile, abn, street and businessName from a fat profile', () => {
    const fat = {
      uid: 'uid-1',
      email: 'Ravi.Kumar.Site@gmail.com',
      displayName: 'Ravi Kumar',
      photoUrl: 'https://example.com/r.jpg',
      mobile: '0400123123',
      abn: '99 999 999 999',
      street: '1 Secret Lane',
      suburb: 'Hidden',
      businessName: 'Hidden Pty',
      role: 'Owner',
    };
    const card = mapPersonPublicCard(fat);
    expect(card).toEqual({
      uid: 'uid-1',
      email: 'ravi.kumar.site@gmail.com',
      displayName: 'Ravi Kumar',
      photoUrl: 'https://example.com/r.jpg',
    });
    expect(card).not.toHaveProperty('mobile');
    expect(card).not.toHaveProperty('abn');
    expect(card).not.toHaveProperty('street');
    expect(card).not.toHaveProperty('businessName');
    expect(JSON.stringify(card)).not.toContain('0400123123');
    expect(JSON.stringify(card)).not.toContain('99 999');
    expect(JSON.stringify(card)).not.toContain('Secret Lane');
    expect(JSON.stringify(card)).not.toContain('Hidden Pty');
    expect(toPublicProfile(fat)).toEqual(card);
  });
});

describe('personPanelModel', () => {
  test('never includes private profile fields even when given a fat object', () => {
    const ravi = rows().find((row) => row.email === site);
    expect(ravi).toBeTruthy();
    const model = personPanelModel({
      profile: {
        uid: 'uid-r',
        email: site,
        displayName: 'Ravi Kumar',
        photoUrl: '',
        mobile: '0400123123',
        abn: '99 999 999 999',
        street: '1 Secret Lane',
        businessName: 'Hidden Pty',
      },
      row: ravi!,
    });
    expect(model.displayName).toBe('Ravi Kumar');
    expect(model.email).toBe(site);
    expect(model).not.toHaveProperty('mobile');
    expect(model).not.toHaveProperty('abn');
    expect(model).not.toHaveProperty('street');
    expect(model).not.toHaveProperty('businessName');
    const blob = JSON.stringify(model);
    expect(blob).not.toContain('0400123123');
    expect(blob).not.toContain('99 999');
    expect(blob).not.toContain('Secret Lane');
    expect(blob).not.toContain('Hidden Pty');
    expect(model.contactNote).toMatch(/directory/);
    expect(model.activitySummary).toContain('History and Cost plan');
    expect(model.activitySummary).not.toMatch(/\d+ expenses/);
  });
});

describe('attention sort and one role per person', () => {
  test('never signed in sorts first, then bounced, then everyone else', () => {
    const listed = buildPeopleRows({
      jobs,
      ownerEmail: owner,
      profiles,
      invites: [
        {
          to: site,
          invitedBy: owner,
          via: 'resend',
          status: 'sent',
          sentAt: new Date('2026-09-09T12:00:00Z'),
        },
        {
          to: viewer,
          invitedBy: owner,
          via: 'resend',
          status: 'bounced',
          sentAt: new Date('2026-09-10T12:00:00Z'),
        },
      ],
      now: NOW,
    });
    expect(listed.map((row) => row.email)).toEqual([
      site,
      viewer,
      otherSite,
      owner,
      manager,
    ]);
    expect(listed[0].lastActiveLabel).toBe('Never');
    expect(listed[0].role).toBe('none');
    expect(listed[0].roleLabel).toBe('No role');
    expect(listed[0].flagLabel).toMatch(/never signed in/i);
  });

  test('strongest visible role wins, with a quiet differs-by-job marker', () => {
    const mixed = buildPeopleRows({
      jobs: [
        {
          projectId: 'job-a',
          name: 'A',
          invitedEmails: [owner, manager],
          managers: [manager],
          viewers: [],
        },
        {
          projectId: 'job-b',
          name: 'B',
          invitedEmails: [owner, manager],
          managers: [],
          viewers: [manager],
        },
      ],
      ownerEmail: owner,
      profiles: [profiles[0], profiles[1]],
      invites: [],
      now: NOW,
    });
    const row = mixed.find((person) => person.email === manager);
    expect(strongestJobRole(['viewer', 'manager', 'site'])).toBe('manager');
    expect(row?.role).toBe('manager');
    expect(row?.roleDiffers).toBe(true);
    expect(row?.roleLabel).toBe('Manager');
  });

  test('a signed-in site person is Site, not No role', () => {
    const row = rows().find((person) => person.email === otherSite);
    expect(row?.role).toBe('site');
    expect(row?.roleLabel).toBe('Site');
  });
});

describe('role control gates', () => {
  test('owner is not editable, including by the owner', () => {
    expect(canActorSetRole({
      actorIsOwner: true,
      actorCanManageJob: true,
      targetIsOwner: true,
      targetRoleOnJob: 'owner',
      nextRole: 'site',
    })).toBe(false);
    expect(roleControlDisabled({
      actorIsOwner: true,
      targetIsOwner: true,
      targetRole: 'owner',
    })).toEqual({ all: true, owner: true, manager: false });
    const planned = planRoleChange({
      jobs,
      email: owner,
      ownerEmail: owner,
      actorEmail: owner,
      actorIsOwner: true,
      nextRole: 'site',
      filterJobId: null,
    });
    expect(planned.jobIds).toEqual([]);
    expect(planned.blockedReason).toMatch(/owner/i);
  });

  test('a manager cannot promote to manager or change another manager', () => {
    expect(canActorSetRole({
      actorIsOwner: false,
      actorCanManageJob: true,
      targetIsOwner: false,
      targetRoleOnJob: 'site',
      nextRole: 'manager',
    })).toBe(false);
    expect(canActorSetRole({
      actorIsOwner: false,
      actorCanManageJob: true,
      targetIsOwner: false,
      targetRoleOnJob: 'manager',
      nextRole: 'site',
    })).toBe(false);
    expect(canActorSetRole({
      actorIsOwner: false,
      actorCanManageJob: true,
      targetIsOwner: false,
      targetRoleOnJob: 'site',
      nextRole: 'viewer',
    })).toBe(true);
    const promote = planRoleChange({
      jobs,
      email: site,
      ownerEmail: owner,
      actorEmail: manager,
      actorIsOwner: false,
      nextRole: 'manager',
      filterJobId: null,
    });
    expect(promote.jobIds).toEqual([]);
    expect(promote.blockedReason).toMatch(/owner can assign Manager/);
    const peer = planRoleChange({
      jobs,
      email: manager,
      ownerEmail: owner,
      actorEmail: 'other-manager@opal.test',
      actorIsOwner: false,
      nextRole: 'site',
      filterJobId: null,
    });
    expect(peer.jobIds).toEqual([]);
  });

  test('owner can assign manager on every job the person is on', () => {
    const planned = planRoleChange({
      jobs,
      email: site,
      ownerEmail: owner,
      actorEmail: owner,
      actorIsOwner: true,
      nextRole: 'manager',
      filterJobId: null,
    });
    expect(planned.jobIds).toEqual(['job-tahmoor']);
    const one = planRoleChange({
      jobs,
      email: manager,
      ownerEmail: owner,
      actorEmail: owner,
      actorIsOwner: true,
      nextRole: 'site',
      filterJobId: 'job-kelly',
    });
    expect(one.jobIds).toEqual(['job-kelly']);
  });

  test('assigning site drops them from both role arrays', () => {
    expect(arraysAfterAssigningRole({
      managers: [manager],
      viewers: [manager],
      email: manager,
      ownerEmail: owner,
      nextRole: 'site',
    })).toEqual({ managers: [], viewers: [] });
  });
});

describe('org-remove stays off the organisation document', () => {
  test('the plan only names job documents the actor can see', () => {
    const plan = planOrgRemove({
      jobs,
      email: manager,
      ownerEmail: owner,
      actorEmail: owner,
      actorIsOwner: true,
    });
    expect(plan.orgTouched).toBe(false);
    expect(plan.fields).toEqual(['invitedEmails', 'managers', 'viewers']);
    expect(plan.jobIds.sort()).toEqual(['job-kelly', 'job-tahmoor']);
    expect(plan).not.toHaveProperty('orgInvitedEmails');
    expect(confirmOrgRemove('Prabhsharan Jabbal', plan.jobNames)).toMatch(/stay on the organisation/);
    expect(confirmOrgRemove('Prabhsharan Jabbal', plan.jobNames)).toMatch(/jobs you can see/);
  });

  test('cannot take the owner off jobs', () => {
    const plan = planOrgRemove({
      jobs,
      email: owner,
      ownerEmail: owner,
      actorEmail: owner,
      actorIsOwner: true,
    });
    expect(plan.orgTouched).toBe(false);
    expect(plan.jobIds).toEqual([]);
  });
});

describe('job filter from the query string', () => {
  test('?job= keeps people on that job', () => {
    expect(peopleSearchFromString('?job=job-kelly&add=1')).toEqual({
      jobId: 'job-kelly',
      add: true,
    });
    const listed = filterPeopleByJob(rows(), 'job-kelly');
    expect(listed.map((row) => row.email).sort()).toEqual([
      otherSite,
      owner,
      manager,
      viewer,
    ].sort());
    expect(listed.some((row) => row.email === site)).toBe(false);
    expect(filterPeopleByJob(rows(), null).length).toBe(5);
  });
});
