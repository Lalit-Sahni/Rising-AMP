import { isPermissionDenied, permissionDeniedMessage } from './permissionMessage';

describe('permissionDeniedMessage', () => {
  test('maps a rules refusal to a plain sentence', () => {
    expect(permissionDeniedMessage({ code: 'permission-denied' })).toBe(
      "You don't have permission to do that.",
    );
    expect(permissionDeniedMessage(
      { message: 'Missing or insufficient permissions.' },
      'invoice',
    )).toBe("You don't have permission to change invoices on this job.");
    expect(permissionDeniedMessage({ code: 'permission-denied' }, 'costPlanLock'))
      .toBe("You don't have permission to lock the cost plan.");
  });

  test('leaves a real application error alone', () => {
    expect(isPermissionDenied({ code: 'unavailable' })).toBe(false);
    expect(permissionDeniedMessage({ message: 'Please enter a name.' }))
      .toBe('Please enter a name.');
  });

  test('treats the Firestore permission string as denied', () => {
    expect(isPermissionDenied({ code: 'permission-denied' })).toBe(true);
    expect(isPermissionDenied(new Error('7 PERMISSION_DENIED: Missing or insufficient permissions.'))).toBe(true);
  });
});
