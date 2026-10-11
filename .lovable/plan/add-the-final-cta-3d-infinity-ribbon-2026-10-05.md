# Add the final CTA 3D infinity ribbon

## Scope
- Install Three.js, React Three Fiber, React Three Drei, and Three.js types.
- Replace only the final CTA’s animated loop with a lazy-loaded 3D TubeGeometry ribbon following a lemniscate curve.
- Keep the existing SVG loop as the fallback on small screens, reduced-motion devices, and browsers without WebGL.
- Mount the 3D canvas only when the final CTA is near the viewport, cap pixel density at 1.5, add slow rotation and restrained pointer tilt, and trigger one full spin after valid form submission.

## Technical details
- Isolate every Three.js import in one new final-CTA visual module; the landing page will load that module through `React.lazy` and `Suspense`.
- Use an intersection observer and browser capability checks before rendering the lazy component.
- Use frame-rate-independent motion in React Three Fiber and monochrome lighting/materials only.
- Preserve the current final CTA layout, form behavior, copy, and SVG styling outside the visual swap.
- Verify the desktop WebGL result, all three fallback paths, success spin, and current build/runtime logs.
