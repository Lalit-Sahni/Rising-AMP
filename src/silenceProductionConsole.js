// Phase 8 A4: production must not print console.log (identifiers, volumes, leftovers).
if (process.env.NODE_ENV === 'production') {
  const mute = () => {};
  console.log = mute;
  console.debug = mute;
  console.info = mute;
}
