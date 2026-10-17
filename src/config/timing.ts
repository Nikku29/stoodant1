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
  // Splash (high tier). Ends by liftAt + lift, which must stay at or under 2.2s.
  splash: {
    letterStart: 0.05,
    letterStagger: 0.07,
    letterJump: 0.5,
    eyesPop: 0.62,
    pop: 0.25,
    blinkAt: 0.95,
    blink: 0.18,
    glanceAt: 1.12,
    glance: 0.5,
    sparksAt: 1.0,
    accentStagger: 0.06,
    stripeAt: 1.06,
    triangleAt: 1.12,
    taglineAt: 1.2,
    phraseStagger: 0.15,
    phraseFade: 0.3,
    liftAt: 1.8,
    lift: 0.4,
    skipLift: 0.3,
    // Low tier: logo fades in whole, blinks once, lifts.
    lowFade: 0.3,
    lowBlinkAt: 0.35,
    lowLiftAt: 0.7,
    lowLift: 0.3,
    // Reduced motion: static logo, then it simply disappears.
    reducedHold: 0.4,
  },
  logo: {
    blinkEvery: 6,
    blink: 0.18,
    waveStagger: 0.05,
    wave: 0.45,
    pupilEase: 0.15,
  },
  // Amber highlighter swoosh behind a heading phrase (src/brand/Highlight.tsx).
  highlight: {
    draw: 0.5,
    heroDelay: 0.3,
    ctaDelay: 0.2,
  },
  // Story slides with ant characters: slide length and the stretch (start %, end %) in which the ant walks.
  // Lengths match the slide keyframes in styles.css.
  slideAnts: {
    pace: { length: 6, walk: [0, 80] },
    shift: { length: 8, walk: [42, 58] },
    path: { length: 9, walk: [6, 58] },
  },
  // Roaming ant (src/brand/RoamingAnt.tsx): seconds, and walking speed in px per second.
  roamer: {
    firstDelay: 8,
    minGap: 25,
    maxGap: 45,
    pop: 0.35,
    speed: 70,
    stay: 6,
    bubbleHold: 6,
    step: 0.36,
  },
  // The ant mascot (src/brand/Ant.tsx).
  ant: {
    step: 0.3,
    wave: 0.9,
    hop: 0.5,
    trailWalk: 1.6,
    ctaLoop: 9,
    ctaArrive: 1.2,
    flagWave: 0.8,
    sparkPop: 0.25,
  },
} as const;
