// Public surface for the cinematic intro module. Re-exports the
// component plus its prop type and the audio mute preference helpers
// so callers (e.g. a future "intro sound" settings toggle) can flip
// the persisted `va:intro-muted` flag without reaching into the
// audio internals directly.
export { IntroAnimation } from './IntroAnimation';
export type { IntroAnimationProps } from './IntroAnimation';
export { isMuted as isIntroMuted, setMuted as setIntroMuted } from './audio';
