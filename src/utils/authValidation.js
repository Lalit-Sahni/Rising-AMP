export function isValidEmail(value) {
  const email = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(value) {
  const password = String(value || '');
  return password.length >= 8 && /\d/.test(password);
}
