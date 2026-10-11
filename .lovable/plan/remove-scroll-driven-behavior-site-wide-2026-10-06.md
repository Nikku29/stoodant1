# Remove scroll-driven behavior site-wide

## Scope
- Restore native browser scrolling and remove Lenis, its animation frame loop, and scroll synchronization.
- Remove all GSAP and ScrollTrigger pin, scrub, and progress logic without changing site copy or visual design.
- Convert How It Works into a four-step, auto-playing sequence that advances every three seconds, restarts at step one on viewport entry, loops, and includes play/pause, previous/next, dots, keyboard, swipe, and reduced-motion behavior.
- Keep desktop’s existing curved process path and cards, lighting each node and drawing each connecting segment in sequence; keep the phone layout vertical and light its steps in the same sequence.
- Replace ordinary reveal and counter triggers with lightweight intersection observers that play only on downward entry and silently reset only after the element is fully below the viewport.
- Keep the custom cursor visually unchanged while making pointer movement transform-only, immediate, and unavailable on touch/coarse pointers.

## Build
1. Replace the shared ScrollTrigger reveal utility with intersection-observer direction tracking for reveals and counters.
2. Remove Lenis, GSAP, ScrollTrigger, page-progress wiring, and obsolete refresh/progress helpers and dependencies.
3. Add a reusable process-sequence controller modeled on the existing slideshow behavior, with three-second timing and accessible controls.
4. Preserve the current How It Works desktop and mobile structures while adding active states and transform-only path progress.
5. Remove obsolete scroll-driven CSS, update the project guidance and roadmap, then verify native scrolling and interactions on desktop and phone widths.

## Technical details
- No scroll handler drives visual progress; viewport entry uses IntersectionObserver.
- Process path drawing uses SVG dash offsets and CSS transitions, not scroll position.
- Cursor coordinates are written directly to translate3d transforms with no transform transition.
- Reduced motion disables autoplay and presents stable states while retaining manual controls.
