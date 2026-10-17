import { useEffect, useRef, useState } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import type { AutoSlide, StorySlideProps } from "@/components/AutoStory";
import { AntUse } from "@/brand/Ant";

const A = SITE_CONFIG.ahead;
// Slide 1 geometry: three steps filling ~80% of the card width.
const STEPS = [{ x: 50, top: 180 }, { x: 155, top: 130 }, { x: 260, top: 80 }];
const STEP_W = 105;

function Stairs() {
  return <g>
    {STEPS.map((s, i) => <g key={i}>
      <rect x={s.x} y={s.top} width={STEP_W} height={226 - s.top} rx="4" className="as-step" />
      <line x1={s.x} y1={s.top} x2={s.x + STEP_W} y2={s.top} className="ps-line" />
      <text x={s.x + STEP_W / 2} y={s.top + 26} className="ps-label">{A.steps[i]}</text>
    </g>)}
  </g>;
}

function ClimbGraphic() {
  return <div className="as-3d"><svg className="ps-svg" viewBox="0 0 400 240" role="img" aria-label="The Stoodant ant hops one step ahead of school pace, up to Future">
    <Stairs />
    <circle cx="312" cy="66" r="16" className="ps-line sa-ripple" />
    <text x="312" y="20" className="ps-label sa-ahead">{A.aheadLabel}</text>
    <g className="sa-school"><AntUse cx={25} base={226} h={22} className="ps-ant ps-ant-school" /><text x="25" y="200" className="ps-label small">{A.schoolPace}</text></g>
    <g className="sa-orb"><g className="sa-squash">
      <text x="102" y="144" className="ps-label small sa-orb-label">{A.stoodantPace}</text>
      <g className="sa-spin"><AntUse cx={102} base={179} h={30} className="ps-ant" /></g>
    </g></g>
  </svg></div>;
}

const CH = [0, 1, 2, 3, 4].map((i) => ({ n: i + 1, x: 20 + i * 74, cx: 52 + i * 74 }));
function Tick({ cx, cy, filled, cls }: { cx: number; cy: number; filled?: boolean; cls?: string }) {
  return <g className={cls}>
    <circle cx={cx} cy={cy} r="8" className={filled ? "ps-fill" : "ps-line"} />
    <path d={`M${cx - 4} ${cy} l3 3 l5 -6`} className={filled ? "sa-tick-dark" : "ps-line"} />
  </g>;
}

function StickGraphic() {
  return <svg className="ps-svg" viewBox="0 0 400 240" role="img" aria-label="Chapters are previewed first, then revised when school reaches them">
    {CH.map((c) => <g key={c.n}>
      <rect x={c.x} y="70" width="64" height="80" rx="10" className="ps-line" />
      <text x={c.cx} y="108" className="ps-label small sa-wide">Chapter {c.n}</text>
      <text x={c.cx} y="64" className="ps-label small sa-narrow">Chapter</text>
      <text x={c.cx} y="114" className="sa-num sa-narrow">{c.n}</text>
      {c.n <= 3 && <Tick cx={c.cx} cy={134} />}
      {c.n >= 4 && <Tick cx={c.cx} cy={134} cls={`sa-prev${c.n}`} />}
      {(c.n === 2 || c.n === 3) && <>
        <rect x={c.x - 5} y="65" width="74" height="90" rx="13" pathLength="1" className={`ps-line sa-ring sa-ring${c.n}`} />
        <Tick cx={c.cx} cy={134} filled cls={`sa-fill${c.n}`} />
        <text x={c.cx} y="50" className={`ps-label sa-revise sa-revise${c.n}`}>{A.reviseLabel}</text>
      </>}
    </g>)}
    <g className="sa-flag"><path d="M44 18h16v22l-8-6l-8 6Z" className="ps-fill dim" /><text x="52" y="12" className="ps-label small">School</text></g>
    <g className="sa-orb2"><AntUse cx={200} base={186} h={28} className="ps-ant" /></g>
    <g className="sa-legend">
      <Tick cx={110} cy={216} /><text x="124" y="220" className="ps-label small ps-start">Previewed</text>
      <Tick cx={230} cy={216} filled /><text x="244" y="220" className="ps-label small ps-start">Revised</text>
    </g>
  </svg>;
}

function Drawing({ kind }: { kind: string }) {
  if (kind === "pizza") return <g><circle cx="300" cy="120" r="56" pathLength="1" className="ps-line as-d" /><path d="M300 64v112M251 92l98 56M251 148l98-56" pathLength="1" className="ps-line as-d d2" /></g>;
  if (kind === "car") return <g><path d="M222 168h160M222 196h160" className="ps-line as-d" pathLength="1" /><path d="M300 182h18M340 182h18M232 182h18M266 182h18" className="ps-line thin as-d d2" pathLength="1" /><path d="M240 150v-16l18-4 16-20h44l20 20 18 4v16Z" className="ps-line as-d d2" pathLength="1" /><circle cx="266" cy="152" r="9" className="ps-line as-d d3" pathLength="1" /><circle cx="334" cy="152" r="9" className="ps-line as-d d3" pathLength="1" /></g>;
  if (kind === "tag") return <g><path d="M240 92l44-30h90v116h-90l-44-30Z" pathLength="1" className="ps-line as-d" /><circle cx="266" cy="120" r="7" className="ps-line as-d d2" pathLength="1" /><text x="330" y="132" className="as-big as-fade">%</text><path d="M300 154l60-64" className="ps-line as-d d3" pathLength="1" /></g>;
  return <g><rect x="238" y="64" width="124" height="96" pathLength="1" className="ps-line as-d" /><path d="M238 136a24 24 0 0 1 24 24" className="ps-line thin as-d d2" pathLength="1" /><path d="M238 180h124M238 174v12M362 174v12M380 64v96M374 64h12M374 160h12" className="ps-line thin as-d d2" pathLength="1" /><text x="300" y="200" className="as-small as-fade">width</text><text x="388" y="116" className="as-small as-fade" transform="rotate(90 388 116)">length</text></g>;
}

function RealLifeGraphic({ active, onDone, reducedMotion, paused }: StorySlideProps) {
  const [i, setI] = useState(0);
  const elapsed = useRef(0);
  const step = 2200;
  useEffect(() => { setI(0); elapsed.current = 0; }, [active]);
  useEffect(() => {
    if (!active || reducedMotion || paused) return;
    let last = performance.now(); let raf = 0;
    const tick = (now: number) => {
      elapsed.current += Math.max(0, now - last); last = now;
      const n = Math.floor(elapsed.current / step);
      if (n >= A.realLife.length) { onDone(); return; }
      setI(n); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reducedMotion, paused, onDone, step]);
  const pair = A.realLife[i]!;
  return <svg className="ps-svg" viewBox="0 0 400 240" role="img" aria-label={`${pair.concept}, connected to a real-life example`}>
    <g key={i} className="as-pair">
      <rect x="12" y="84" width="170" height="72" rx="14" className="ps-line thin as-concept-box" />
      <foreignObject x="18" y="86" width="158" height="68"><div className="as-concept">{pair.concept}</div></foreignObject>
      <line x1="184" y1="120" x2="226" y2="120" className="ps-line as-d" pathLength="1" />
      <Drawing kind={pair.drawing} />
    </g>
    <g>{A.realLife.map((_, n) => <circle key={n} cx={182 + n * 12} cy="226" r="3" className={n === i ? "ps-fill" : "ps-fill dim as-off"} />)}</g>
  </svg>;
}

const graphics = [<ClimbGraphic key="a" />, <StickGraphic key="b" />];
export const AHEAD_SLIDES: AutoSlide[] = A.slides.map((s, i) => (i === 2 ? { title: s.title, caption: s.caption, Graphic: RealLifeGraphic } : { title: s.title, caption: s.caption, graphic: graphics[i] }));
