// Geometry of the Final CTA ant scene, shared by AntFlagScene.tsx and the loop keyframes in brandCss.ts.
// Path from the start point to the flag (viewBox units). The ant's feet follow this straight, gently rising line.
export const START = { x: 40, y: 150 };
export const FLAG = { x: 318, y: 128 };
export const SLOPE = (FLAG.y - START.y) / (FLAG.x - START.x);
export const SLOPE_DEG = (Math.atan(SLOPE) * 180) / Math.PI;
/** Walker transform at fraction t of the way to the flag (shared with the loop keyframes in brandCss). */
export const sceneAt = (t: number) => `translate(${((FLAG.x - START.x) * t).toFixed(1)}px,${((FLAG.y - START.y) * t).toFixed(1)}px)`;
