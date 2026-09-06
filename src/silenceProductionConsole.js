if (import.meta.env.PROD) {
  const mute = () => {};
  console.log = mute;
  console.debug = mute;
  console.info = mute;
}
