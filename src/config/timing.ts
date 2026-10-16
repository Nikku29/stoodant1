// Single source of truth for animation timings (seconds). Components import these; never hard-code durations.
export const TIMING = {
  reveal: 0.5,
  stagger: 0.05,
  crossfade: 0.35,
  storySlideAnim: 2.5,
  readHold: 1,
  storyWatchdog: 4.5,
  realLifePair: 1.2,
  howItWorksStep: 1.5,
  heroDeckAdvance: 3,
  teachersAdvance: 2.5,
  teachersStep: 0.7,
} as const;
