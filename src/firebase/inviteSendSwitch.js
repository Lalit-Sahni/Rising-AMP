export function isInviteFunctionUnavailable(error) {
  const code = String((error && error.code) || '');
  if (
    code === 'functions/invalid-argument' ||
    code === 'functions/permission-denied' ||
    code === 'functions/unauthenticated' ||
    code === 'functions/failed-precondition' ||
    code === 'functions/already-exists'
  ) {
    return false;
  }
  return true;
}
