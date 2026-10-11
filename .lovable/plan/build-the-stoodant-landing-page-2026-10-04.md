# Build the Stoodant landing page

## Scope
- Replace the blank home screen with the complete single-page Stoodant experience in the exact requested section order.
- Keep every editable word, contact detail, FAQ answer, pricing label, teacher placeholder, and form label in one site configuration file.
- Implement pricing and offer rules once, then reuse them in the announcement, pricing cards, and final form.
- Use only the supplied monochrome palette, inline line-art, specified fonts, and the requested animation libraries.

## Build approach
1. Add the Stoodant configuration and tested pricing helpers.
2. Build reusable brand, heading, button, illustration, animation, and form pieces.
3. Assemble all sections: navigation, hero, two pinned stories, gap, roadmap, pricing, comparison, marquees, teachers, progress preview, review placeholders, FAQ, demo form, and footer.
4. Add first-visit loading, smooth scrolling, scroll progress, desktop cursor, mobile menu, offer dismissal, motion preferences, validation, SEO, and accessibility.
5. Verify pricing examples, production compilation, desktop and mobile presentation, navigation, FAQ, offer behavior, and form success.

## Technical details
- Preserve TanStack Start’s existing page structure while using React, TypeScript, Vite, and Tailwind.
- Add Motion for React, GSAP with ScrollTrigger, and Lenis; use Lucide for interface icons only.
- Use client-safe setup and cleanup for browser animation code so server rendering remains stable.
- Record the centralized-content architecture in the project guidance file.
