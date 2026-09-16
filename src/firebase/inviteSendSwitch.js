/**
 * The Gmail fallback exists for exactly one case: the sendJobInviteEmail
 * Cloud Function is not deployed. Everything else — including
 * functions/internal, which is what the function throws when Resend
 * rejects the send — is a real error and must surface to the user.
 */
export function isInviteFunctionUnavailable(error) {
  const code = String((error && error.code) || '');
  return code === 'functions/not-found' || code === 'functions/unimplemented';
}
