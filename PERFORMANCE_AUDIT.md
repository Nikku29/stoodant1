# Stoodant mobile performance audit

Date: 2026-10-16 · Branch: `perf/mobile` · Scope: step (a) only, no code changes.

Target device (CLAUDE.md): Moto G Power class, Slow 4G, 4x CPU throttle. Targets: Performance >= 85, LCP < 2.5s, TBT < 200ms, CLS < 0.1, initial JS <= 150 KB gzip.

## How this was measured

- Read every file under `src/` (landing, all section components, `styles.css`, `teachers-ring.css`, config, root route).
- Ran `vite build` locally and attributed every byte of each client chunk to its npm package using the sourcemaps (script kept outside the repo). Numbers below are from that build.
- A Lighthouse run was **not** done yet: Lighthouse is not installed in the project and adding it is a new dependency. Proposed as the first step of (b) so every fix has a before/after number.

## 1. Headline numbers (production build, today)

| Asset | Raw | Gzip | Loaded |
|---|---|---|---|
| `index-*.js` (React, router, Start runtime) | 369 KB | **117.4 KB** | initial |
| `routes-*.js` (whole landing page + framer-motion) | 222 KB | **71.6 KB** | initial |
| **Initial JS total** | 591 KB | **~189 KB** | target 150 KB, **26% over** |
| `styles-*.css` | 125 KB | 23.1 KB | initial, render-blocking |
| `routes-*.css` (Teachers ring) | 4.3 KB | 1.6 KB | initial |
| Google Fonts CSS + 5 font files | — | external | initial, render-blocking, 2 extra origins |
| `FinalCtaInfinityRibbon-*.js` (three.js) | 967 KB | 261 KB | lazy, desktop >= 768px |

What is inside the initial JS (gzip, approximate share):

| Package | Gzip | Note |
|---|---|---|
| react-dom + react + scheduler | ~67 KB | unavoidable |
| motion-dom + framer-motion | **~47 KB** | full `motion` component, no LazyMotion |
| @tanstack/router-core + react-router + start-client + history + store | ~28 KB | SSR framework runtime |
| seroval (SSR data serialiser) | ~7.5 KB | only needed because of SSR |
| @tanstack/query-core | **~7.5 KB** | **unused**: no `useQuery` anywhere |
| App code (all sections + siteConfig) | ~21 KB | every section ships up front |
| lucide-react | ~0.6 KB | fine, named imports |

What is inside the three.js chunk: `three` 153 KB, `@react-three/fiber` 44 KB, `three-stdlib` 7 KB, gainmap-js 4 KB (pulled in by drei's `<Environment>`), drei 2 KB.

GSAP is listed in CLAUDE.md but is **not installed** and not imported, so it costs nothing today.

## 2. Findings, ordered by impact on a mid-range Android

### P0: blocks the targets

**1. The hero headline is invisible until JavaScript finishes (LCP).**
`StoodantLanding.tsx:190-193`. The h1 lines start at `y: "110%"` inside an `overflow:hidden` mask, and the subhead, buttons and trust line start at `opacity: 0`. Framer Motion writes these initial styles into the server HTML, so the first paint shows an empty hero. Text only appears after ~189 KB of JS downloads, parses and hydrates on a throttled CPU, plus a 0.3–1.1s entrance animation. On Slow 4G this alone very likely pushes LCP well past 2.5s. The loader (`Loader`, 1.9s, all devices) then covers the page again after hydration on first visit.
Fix: render the hero copy visible in the HTML; run the entrance as a CSS animation that is already in its final state if JS is late (or skip it on the low tier). Skip the loader on the low tier, as CLAUDE.md requires.

**2. Initial JS is ~189 KB gzip, 39 KB over budget, and everything below the fold ships up front.**
`StoodantLanding.tsx:6-12` statically imports every section. Savings available without touching design:
- Lazy-load every section below the hero (React.lazy + Suspense near the viewport): moves ~15 KB gz of app code out.
- Switch to `LazyMotion` + `domAnimation` + `m`: framer-motion ~47 KB → ~20–25 KB gz initial.
- Remove `@tanstack/react-query` and `QueryClientProvider` (`__root.tsx:1,119`, `router.tsx`): ~7.5 KB gz.
- Estimated result: ~130–140 KB gz, inside budget with no framework change.

**3. Render-blocking Google Fonts.** `__root.tsx:90-92` loads Inter and Sora from fonts.googleapis.com: two extra DNS/TLS handshakes on Slow 4G before text can render with the right font. CLAUDE.md requires self-hosted `@fontsource` (latin, used weights only) with the hero font preloaded. Adds two small dev dependencies (font files only, no JS).

**4. Endless JS-driven loops in the hero on phones.** These run every frame for as long as the page is open, including after the user has scrolled away and when the tab is hidden:
- Deck bob `y: [0,-6,0,6,0]` runs **only** on coarse pointers, i.e. exactly on phones (`HeroSubjectDeck.tsx:99-100`).
- 8 floating chips with infinite x/y loops (`HeroSubjectDeck.tsx:240`); 4 are `display:none` on mobile but keep animating.
- 7 `FloatingShapes` infinite loops (`StoodantLanding.tsx:201-203`); all `display:none` on mobile but keep animating.
- Science bubbles (4 infinite) and the Social globe ellipse (infinite), per active card.
- Subject auto-advance `setInterval(…, 2000)` is hard-coded (TIMING says `heroDeckAdvance: 3`) and never pauses offscreen or on a hidden tab; each tick re-renders the whole deck and remounts the lesson with per-character `TypeLine` spans.
That is up to ~20 main-thread animations on phones, forever. Fix: low tier gets a flat deck with crossfade only, no bob, no chips, no shapes; all loops pause offscreen and on `document.hidden`.

**5. Teachers ring is the most expensive section to scroll past on mobile.** (`TeachersRing.tsx`, `teachers-ring.css`)
- Every one of the 6 slides has a `.tr-blur` overlay with `backdrop-filter: blur(6px)` whose opacity animates with the ring. Backdrop blur on 3D-transformed layers is one of the heaviest things a mobile GPU can do, and CLAUDE.md forbids backdrop-filter on the low tier.
- 36 twinkling specks run infinite CSS opacity animations (each a repaint).
- 6 cards each carry a `0 24px 60px` box shadow inside a `preserve-3d` scene.
- Good already: auto-advance pauses offscreen, on hidden tab, on hover/focus, and the transforms use motion values, not React state.
Fix: low tier gets a flat 2D version (front card sharp, neighbours dimmed with plain opacity, no backdrop blur, no specks), keeping the same 3-visible layout and message.

### P1: hurts frame rate while scrolling

**6. Full-screen grain overlay.** `styles.css:32` puts a fixed `body::before` with an SVG `feTurbulence` texture over the entire viewport at z-index 1000. That is an extra full-screen layer composited on every scroll frame. CLAUDE.md: no grain on the low tier.

**7. Sticky navbar `backdrop-filter: blur(16px)`.** `styles.css:54`. Re-blurs whatever scrolls under it on every frame. Low tier: the same colour at 96–100% opacity, no blur (visually near-identical on white/black sections).

**8. Final CTA three.js ribbon never stops rendering.** `FinalCtaInfinityRibbon.tsx`. The R3F `<Canvas>` uses the default `frameloop="always"`, so once loaded it renders at 60fps even when scrolled away. It is gated only by `max-width: 767px` and reduced motion, so tablets and coarse-pointer laptops (768–1023px) still download 261 KB and run WebGL; CLAUDE.md puts width < 1024 and coarse pointers on the low tier. drei's `<Environment>` pulls in gainmap/HDR loaders just to light one tube. Fix: gate on the high tier, pause the frameloop offscreen/hidden, and consider replacing `<Environment>` with the existing directional lights (drops drei; saves a few KB, mostly parse time).

**9. Problem slide 4 animates a blurred SVG group.** `ProblemSlides.tsx:89-91` applies an `feGaussianBlur stdDeviation=8` filter to the mist group, and `.rd-mist` animates its transform for 9s. The filter is re-rasterised every frame. CLAUDE.md: no animated filter/blur. Fix: pre-blur once (static soft gradient shapes) and animate only opacity/transform of an unfiltered layer.

**10. "How it works" wave runs a rAF loop forever.** `ProcessSequence.tsx:109-136` schedules `requestAnimationFrame` every frame for the life of the page once drawn; when offscreen it only skips the work. On desktop it also calls `getTotalLength()`, `getPointAtLength()` and `getBoundingClientRect()` every frame. Fix: stop the loop when offscreen/hidden (shared observer hook) and cache path length and width (already measured in the ResizeObserver).

**11. Every reveal has its own IntersectionObserver.** `directional-reveal.tsx:20`. Each `Reveal`, `SectionHeading` and `Counter` creates a separate observer (roughly 40+ on the page), and every heading splits into one `motion.i` per word. Cheap individually, but on a 4x-throttled CPU this adds up during hydration (TBT). CLAUDE.md asks for one shared observer hook.

**12. Below-the-fold sections have no `content-visibility: auto`.** The browser lays out and paints the whole long page at load. Adding `content-visibility: auto` + `contain-intrinsic-size` per section cuts initial rendering work substantially on low-end phones.

### P2: smaller wins and rule violations

13. **Marquees never pause offscreen** (`styles.css:98`). Two infinite CSS animations on very wide text rows. Cheap on the compositor, but CLAUDE.md says all loops pause offscreen.
14. **AutoStory clock uses rAF every frame** while a slide is on screen (`AutoStory.tsx:111-124`), and `RealLifeGraphic` calls `setI` every frame (`AheadSlides.tsx:81-86`). A timeout per phase does the same with no per-frame work.
15. **FAQ animates `height: auto`** (`StoodantLanding.tsx:266`), which causes layout each frame. User-triggered and short, so low priority.
16. **Pricing card hover pulse** runs an infinite scale animation on up to 20 dots per card while hovered. Desktop only in practice.
17. **CSS is 125 KB raw.** ~62 KB is `styles.css`, ~15 KB `tw-animate-css`, and roughly 45 KB is Tailwind utilities generated from scanning the 48 unused shadcn files in `src/components/ui/` (`@source "../src"`). Trimming the scan to the files actually used (or deleting the unused shadcn components) cuts CSS without changing any styles in use.
18. **Custom cursor and magnetic buttons** attach listeners on every device; they are hidden by CSS on touch but still run. Should not mount on the low tier.
19. **Hero 3D tilt** (`HeroSubjectDeck.tsx:53-54`) creates springs and 8 `useTransform`s per chip on all devices even when tilt is disabled.
20. **Unused dependencies in `package.json`**: recharts, embla, cmdk, vaul, react-day-picker, input-otp, date-fns, react-resizable-panels, sonner, most @radix-ui packages. They are tree-shaken out of the bundle today (no bundle cost), but slow installs and invite accidental imports.

### Bugs noticed in passing (not performance, not fixing without approval)

- `.cta-loop path` references `animation: loop-draw`, but no `@keyframes loop-draw` exists, so the 2D fallback loop in the Final CTA never animates (`styles.css:103`).
- Hero deck interval is 2000ms instead of `TIMING.heroDeckAdvance` (3s), and the hero deck has no "Paused · tap to resume" tap toggle.
- Demo form logs the parent's phone number to the console (`StoodantLanding.tsx:305`). CLAUDE.md forbids personal data in logs; this goes away when the Firestore form lands in step (d).

## 3. Proposed performance tier (`src/lib/perf.ts`, `usePerfTier()`)

One hook, read once on mount, exposed via context so every effect consults it. Matches the CLAUDE.md definition.

**Low tier if any of:** `pointer: coarse`, viewport width < 1024, `navigator.hardwareConcurrency <= 4`, `navigator.deviceMemory <= 4`, `navigator.connection.saveData`, `prefers-reduced-motion: reduce`.
**High tier otherwise:** desktop, fine pointer, >= 8 cores or unknown.

The server HTML must render the same thing for both tiers (the low/flat version is the safe default), with high-tier extras added after mount, so there is no hydration mismatch and no layout shift.

| Effect | High tier | Low tier | Reduced motion |
|---|---|---|---|
| Loader | first visit, max 2.2s, never blocks hero | skipped | skipped |
| Hero headline / copy | visible in HTML, CSS entrance | visible in HTML, short fade or none | visible, no motion |
| Hero subject deck | CSS 3D stack, tilt, 8 chips | flat stack, crossfade, no bob, no chips | static first card, tabs only |
| Floating background shapes | on | off | off |
| Grain overlay | on | off | off |
| Navbar | backdrop blur | solid colour, no blur | solid |
| Custom cursor, magnetic buttons | on | not mounted | not mounted |
| Section reveals | fade-up once, shared observer | fade-up once (opacity + small y), shared observer | 0.3s fade |
| Problem / Stay Ahead slideshows | as today, mist without filter | same slides, fewer simultaneous loops, no 3D tilt on slide 1 | stacked final states |
| How it works wave | curve + dot loop | vertical line + lit card, stops offscreen | all lit, static |
| Marquees | running, pause offscreen | running, pause offscreen | static |
| Teachers ring | 3D ring, blurred neighbours, specks | flat 2D ring: sharp front + 2 dimmed neighbours, no backdrop blur, no specks | horizontal scroll row |
| Final CTA ribbon | lazy three.js, paused offscreen | 2D SVG loop, three.js never downloaded | static SVG |

Every looping or auto-advancing piece uses one shared `useInView` IntersectionObserver hook plus `document.hidden`.

## 4. Proposed fix order for step (b), by impact

Each step is a separate small commit with before/after numbers.

1. Add a reproducible measurement (Lighthouse mobile preset against a local production preview) and record the baseline.
2. Hero renders visible in HTML; loader skipped on low tier and never covers the hero. (LCP)
3. Self-host fonts via `@fontsource` (Inter 400/500/600, Sora 600/700/800, latin), preload the hero font, drop Google Fonts. (LCP, FCP)
4. Remove react-query; switch to `LazyMotion` + `m`; lazy-load all below-the-fold sections. (initial JS ~189 → ~130–140 KB gz, TBT)
5. Add `perf.ts` / `usePerfTier` and the shared `useInView` hook.
6. Apply the tier: hero loops, floating shapes, grain, navbar blur, cursor and magnetic buttons.
7. Teachers ring flat 2D variant on the low tier; remove backdrop blur and specks there.
8. Final CTA ribbon: high tier only, pause frameloop offscreen/hidden.
9. Stop forever-running loops: ProcessSequence rAF, marquees offscreen, AutoStory/RealLife per-frame state, mist filter.
10. `content-visibility: auto` on below-the-fold sections; trim Tailwind's `@source` to used files.

Expected outcome: initial JS within 150 KB gz, hero text in the first paint, and no infinite animations running on phones outside the section on screen. Exact Lighthouse numbers will be reported per step.

## 5. Notes for steps (c) and (d)

- **Hosting mismatch.** The build currently targets Cloudflare Workers with server-side rendering (Nitro preset `cloudflare-module`, see `vite.config.ts` and `src/server.ts`). Firebase Hosting serves static files only. Two options for (c):
  - Keep TanStack Start and switch it to static prerender of `/` (SPA fallback for anything else). Keeps Lovable compatibility and keeps the hero in the HTML, which helps LCP. **Recommended.**
  - Replace TanStack Start with a plain Vite + React SPA. Saves roughly another 35 KB gz (router, Start runtime, seroval), but the hero would no longer be in the HTML, and it would likely break the Lovable project sync.
- **Firebase SDK** must be imported dynamically when the form nears the viewport or gets focus; the modular Firestore + App Check SDKs are roughly 60–90 KB gz and must never land in the initial bundle.
