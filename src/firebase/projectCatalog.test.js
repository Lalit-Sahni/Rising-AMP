import { canRemoveEmailFromJob, isJobArchived, newJobId } from './jobIdentity';

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
