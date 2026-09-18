import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canRemoveEmailFromJob, emailRemainsOnJobs, invitedJobsFingerprint, isJobArchived, newJobId } from './jobIdentity';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('treats missing status as active', () => {
  expect(isJobArchived({})).toBe(false);
  expect(isJobArchived({ status: 'active' })).toBe(false);
  expect(isJobArchived({ status: 'archived' })).toBe(true);
});

test('refuses to remove the owner from a job', () => {
  expect(canRemoveEmailFromJob({
    email: 'Owner.Name@gmail.com',
    ownerEmail: 'ownername@gmail.com',
  })).toBe(false);
  expect(canRemoveEmailFromJob({
    email: 'bookkeeper@opal.test',
    ownerEmail: 'ownername@gmail.com',
  })).toBe(true);
});

test('new job ids look like the Phase 1 job documents', () => {
  expect(newJobId()).toMatch(/^job-[a-f0-9]{16}$/);
});

test('detects whether a removed email is still on another readable job', () => {
  const jobs = [
    { invitedEmails: ['owner@opal.test', 'bookkeeper@opal.test'] },
    { invitedEmails: ['owner@opal.test'] },
  ];
  expect(emailRemainsOnJobs(jobs, 'bookkeeper@opal.test')).toBe(true);
  expect(emailRemainsOnJobs(jobs, 'gone@opal.test')).toBe(false);
  expect(emailRemainsOnJobs([{ invitedEmails: ['Owner.Name@gmail.com'] }], 'ownername@gmail.com')).toBe(true);
});

test('job list fingerprint ignores order and notices a rename', () => {
  const a = [
    { projectId: 'job-b', name: 'Kelly', status: 'active', kind: 'client', invitedEmails: ['a@x'] },
    { projectId: 'job-a', name: 'Centenary', status: 'active', kind: 'own', invitedEmails: ['a@x'] },
  ];
  expect(invitedJobsFingerprint(a)).toBe(invitedJobsFingerprint([...a].reverse()));
  expect(invitedJobsFingerprint(a)).not.toBe(
    invitedJobsFingerprint([{ ...a[0], name: 'Kelly Street' }, a[1]]),
  );
  expect(invitedJobsFingerprint(a)).not.toBe(
    invitedJobsFingerprint([{ ...a[0], managers: ['boss@x'] }, a[1]]),
  );
});

test('removeEmailFromProject never writes organisation invitedEmails', () => {
  const source = fs.readFileSync(path.join(root, 'src/firebase/projectCatalog.js'), 'utf8');
  const start = source.indexOf('export async function removeEmailFromProject');
  const next = source.indexOf('\nexport ', start + 10);
  const fn = source.slice(start, next === -1 ? undefined : next);
  expect(fn).toContain('Never writes the organisation document');
  expect(fn).toContain('invitedEmails: arrayRemove');
  expect(fn).toContain('formerEmails: arrayUnion');
  expect(fn).toContain('payload.managers');
  expect(fn).toContain('payload.viewers');
  expect(fn).not.toContain('emailRemainsOnJobs');
  expect(fn).not.toMatch(/updateDoc\(doc\(db, 'organizations', orgId\(\)\),/);
  const invite = source.slice(
    source.indexOf('export async function inviteEmailToProject'),
    source.indexOf('export async function removeEmailFromProject'),
  );
  expect(invite).toContain("updateDoc(doc(db, 'organizations', orgId()),");
  expect(invite).toContain('invitedEmails: arrayUnion');
});
