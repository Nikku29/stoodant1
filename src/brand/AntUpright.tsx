// The Stoodant ant, upright "student" style (soft 3D sticker look): stands on two legs, logo glasses, yellow school bag.
// One <symbol>, reused with <use>. Limbs move via inherited custom properties (--ant-walk, --ant-wave),
// exactly like the side-view ant, so the same tier / reduced-motion rules apply.
import { BRAND_COLORS } from "./logoMarkup";

export const ANT_UPRIGHT_ID = "stoodant-ant-upright";

const { amber, white, pupilOnDark: ink } = BRAND_COLORS;
// Per-instance colour overrides (e.g. the grey "School pace" ant): --ant-eye, --ant-bag, --ant-bag-light, --ant-bag-deep.
const EYE = { fill: `var(--ant-eye, ${amber})` };
const BAG = { fill: `var(--ant-bag, ${amber})` };
const BAG_LIGHT = { fill: "var(--ant-bag-light, #FFD166)" };
const BAG_DEEP = { stroke: "var(--ant-bag-deep, #E88F00)" };
const outline = { stroke: "currentColor", strokeWidth: 2.2, strokeLinejoin: "round" as const };
const limb = { fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** A body segment with soft tonal shading (neutral greys only) to read as 3D. */
function Part({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#E5E5E5" />
      <ellipse cx={cx + rx * 0.28} cy={cy + ry * 0.22} rx={rx * 0.62} ry={ry * 0.62} fill="#D4D4D4" />
      <ellipse cx={cx - rx * 0.35} cy={cy - ry * 0.4} rx={rx * 0.32} ry={ry * 0.22} fill={white} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" {...outline} />
    </>
  );
}

function Eye({ x }: { x: number }) {
  return (
    <>
      <circle cx={x} cy="26" r="4" style={EYE} />
      <circle cx={x + 1} cy="25.4" r="1.9" fill={ink} />
      <circle cx={x + 1.7} cy="24.6" r=".7" fill={white} />
      <circle cx={x} cy="26" r="4.4" fill="none" stroke={ink} strokeWidth="2" />
    </>
  );
}

/** Rendered inside AntSprite's <svg>. */
export function AntUprightSymbol() {
  return (
    <symbol id={ANT_UPRIGHT_ID} viewBox="0 0 80 100">
      <ellipse className="au-shadow" cx="40" cy="95" rx="18" ry="3" fill="#A3A3A3" opacity=".35" />
      <path className="au-leg au-leg-l" d="M36 77l-2 15-5 1" {...limb} />
      <path className="au-leg au-leg-r" d="M44 77l2 15 5 1" {...limb} />
      <g className="au-body">
        <g className="au-bag">
          <rect x="45" y="39" width="17" height="25" rx="6" style={BAG} {...outline} />
          <path d="M57 41.5a4 4 0 0 1 3 4V60" fill="none" style={BAG_DEEP} strokeWidth="3" strokeLinecap="round" />
          <rect x="48" y="42" width="4" height="9" rx="2" style={BAG_LIGHT} />
          <path d="M45 49h17" fill="none" {...outline} />
        </g>
        <path d="M33 61l-7 5-2 6M47 61l7 5" {...limb} />
        <Part cx={40} cy={72} rx={10} ry={9} />
        <Part cx={40} cy={52} rx={8.5} ry={10} />
        <path d="M45 43.5q3 2 3.5 6" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        <path className="au-arm-l" d="M33 47l-8-5-2-9" {...limb} />
        <path className="au-arm-r" d="M47 48l6 8" {...limb} />
        <Part cx={40} cy={26} rx={13} ry={13} />
        <path d="M36.5 33q3.5 3 7 0" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        <path d="M36 14Q33 8 29 4M44 14Q47 8 51 4" {...limb} strokeWidth="2.5" />
        <circle cx="29" cy="4" r="2.3" style={EYE} />
        <circle cx="51" cy="4" r="2.3" style={EYE} />
        <path d="M38.8 26h2.4" stroke={ink} strokeWidth="2" />
        <Eye x={34.4} />
        <Eye x={45.6} />
      </g>
    </symbol>
  );
}
