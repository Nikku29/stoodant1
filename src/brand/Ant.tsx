// The Stoodant ant: the upright "student" ant (src/brand/AntUpright.tsx), one <symbol> defined once
// (<AntSprite />) and reused everywhere with <use>. Poses are driven by custom properties that inherit
// into each <use> instance (see the ant rules in brandCss.ts).
import { ANT_UPRIGHT_ID, AntUprightSymbol } from "./AntUpright";

export const ANT_SYMBOL_ID = ANT_UPRIGHT_ID;
export type AntPose = "walk" | "wave" | "celebrate" | "static";

// Where the feet touch the ground and the centre line, as fractions of the 80x100 symbol box.
const FEET_Y = 0.93;
const ASPECT = 0.8;

/** Render once per page (it draws nothing). */
export function AntSprite() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <AntUprightSymbol />
    </svg>
  );
}

/** Place the ant inside an <svg> scene: centred on cx, feet on y = base, h units tall. */
export function AntUse({ cx, base, h, pose = "static", className = "" }: { cx: number; base: number; h: number; pose?: AntPose; className?: string }) {
  const w = h * ASPECT;
  return <use href={`#${ANT_SYMBOL_ID}`} x={cx - w / 2} y={base - h * FEET_Y} width={w} height={h} className={`ant ant-${pose} ${className}`.trim()} />;
}
