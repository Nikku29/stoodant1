# Replace the hero subject deck

## Scope
- Create `HeroSubjectDeck.tsx` and replace only the current right-side hero card stack.
- Preserve the hero copy, actions, trust line, background shapes, navigation, and every later section unchanged.

## Build
1. Define the four subjects, live lesson strings, and eight floating-chip labels together at the top of the new component.
2. Build the layered CSS-3D deck with one readable active card and three labelled card peeks.
3. Add the requested active-card visuals: animated maths diagrams and formulas, science beaker and bubbles, English grammar markup, and social-science globe and chips.
4. Add four accessible subject tabs, the four-second timer, pause behavior, card cycling, depth-aware chips, pointer tilt, and touch bobbing.
5. Add reduced-motion behavior and a 375px layout that fits without horizontal scrolling and shows four chips.
6. Remove only the obsolete hero stack styles and helper, then verify the hero on desktop, touch-size mobile, keyboard interaction, and reduced motion.

## Technical details
- Use the project’s existing Motion dependency and CSS 3D transforms; add no library.
- Use semantic monochrome tokens, transform/opacity animation only, and `will-change: transform` only on the deck.
