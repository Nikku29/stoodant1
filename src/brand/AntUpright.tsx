// The Stoodant ant: the 3D mascot as one <symbol>, reused with <use> everywhere a small ant appears
// (story slides, ant trail, final CTA scene, login). Legs and body move via the au-* rules in brandCss.ts,
// driven by inherited custom properties (--ant-walk), so the same tier / reduced-motion rules apply.

export const ANT_UPRIGHT_ID = "stoodant-ant-upright";

// The mascot art (public/mascot/, cut from the 3D character sheet): two legs behind the body on one
// 178x440 canvas, placed so the feet stand on y = 93 of the 80x100 symbol box like the drawn ant did.
const FIG = { x: 21.2, y: 0, width: 37.6, height: 93 };

/** Rendered inside AntSprite's <svg>. */
export function AntUprightSymbol() {
  return (
    <symbol id={ANT_UPRIGHT_ID} viewBox="0 0 80 100">
      <ellipse className="au-shadow" cx="40" cy="95" rx="15" ry="2.6" fill="#0A1026" opacity=".18" />
      <image className="au-leg au-leg-l" href="/mascot/leg-l.webp" {...FIG} />
      <image className="au-leg au-leg-r" href="/mascot/leg-r.webp" {...FIG} />
      <image className="au-body" href="/mascot/body.webp" {...FIG} />
    </symbol>
  );
}
