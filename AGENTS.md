# Notes for coding agents

- Keep all editable Stoodant content, prices, labels, and contact details in `src/config/siteConfig.ts` so the page has one source of truth.
- Keep the hero's live subject curriculum and floating-chip content centralized at the top of `HeroSubjectDeck.tsx` because that component owns the self-contained teaching visual.
- Keep Stay Ahead’s editable step descriptions and pace labels in siteConfig; its 3D animation stays in the section so the surrounding layout remains unchanged.
- Keep Three.js isolated to the lazy-loaded final CTA infinity-ribbon module so the rest of the landing page stays lightweight.
- Route ordinary reveal and counter entry behavior through `src/lib/directional-reveal.tsx`, which uses IntersectionObserver so visual progress never depends on scroll position.
- Story sections (Problem, Stay Ahead) use the shared AutoStory component: slides report onDone after one play-through, AutoStory owns holds, watchdog, pausing and looping, so timing never depends on fixed timers.
