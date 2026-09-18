import { inviteNeedsGmailCopy } from './emailAddress';

describe('inviteNeedsGmailCopy', () => {
  test('Outlook and company mailboxes need a Gmail copy; Gmail does not', () => {
    expect(inviteNeedsGmailCopy('lalit@opalssconstructions.com.au')).toBe(true);
    expect(inviteNeedsGmailCopy('mannat@outlook.com')).toBe(true);
    expect(inviteNeedsGmailCopy('sahni.lalit18@gmail.com')).toBe(false);
    expect(inviteNeedsGmailCopy('name@googlemail.com')).toBe(false);
    expect(inviteNeedsGmailCopy('')).toBe(false);
  });
});
