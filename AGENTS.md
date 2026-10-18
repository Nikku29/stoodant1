# Notes for coding agents

- Keep all editable Stoodant content, prices, labels, and contact details in `src/config/siteConfig.ts` so the page has one source of truth.
- Keep the hero's live subject curriculum and floating-chip content centralized at the top of `HeroSubjectDeck.tsx` because that component owns the self-contained teaching visual.
- Keep Stay Ahead’s editable step descriptions and pace labels in siteConfig; its 3D animation stays in the section so the surrounding layout remains unchanged.
- No WebGL or Three.js. The logo lives only in `src/brand/logoMarkup.ts` (rendered by `<Logo />`); the ant mascot is one SVG `<symbol>` in `src/brand/Ant.tsx`, reused with `<use>`.
- Route ordinary reveal and counter entry behavior through `src/lib/directional-reveal.tsx`, which uses IntersectionObserver so visual progress never depends on scroll position.
- Story sections (Problem, Stay Ahead) use the shared AutoStory component: slides report onDone after one play-through, AutoStory owns holds, watchdog, pausing and looping, so timing never depends on fixed timers.
- Parent dashboard (`/parent`) and teacher page (`/teacher`) labels and insight thresholds live in `src/config/dashboardConfig.ts`, not siteConfig, so they never ship with the landing page. Insight formulas live only in `src/lib/progress/insights.ts`; WhatsApp report text only in `src/lib/progress/reportText.ts`. See PROGRESS_PLAN.md.
