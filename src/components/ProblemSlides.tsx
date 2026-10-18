import type { ReactNode } from "react";
import { AntUse } from "@/brand/Ant";
import { buildLogo, logoViewBox } from "@/brand/logoMarkup";
import { SITE_CONFIG } from "@/config/siteConfig";

const MOOD = SITE_CONFIG.problem.shiftMood;
// Small Stoodant wordmark at the top of the "Now" lesson (white letters on the dark slide).
const NOW_LOGO = buildLogo("wordmark", "dark", "nwlg");

const wide = Array.from({ length: 40 }, (_, i) => ({ x: 56 + (i % 10) * 32, y: 96 + Math.floor(i / 10) * 30 }));
const narrow = Array.from({ length: 40 }, (_, i) => ({ x: 88 + (i % 8) * 32, y: 88 + Math.floor(i / 8) * 28 }));

function Crowd({ dots, focus, cls }: { dots: { x: number; y: number }[]; focus: number; cls: string }) {
  const picks = [dots[focus]!, dots[(focus + 13) % dots.length]!];
  return <g className={cls}>
    {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="5" className="ps-dot" />)}
    {picks.map((f, k) => <g key={k} className={k ? "ps-second" : undefined}>
      <circle cx={f.x} cy={f.y} r="5" className="ps-lit" />
      <g className="ps-ask"><circle cx={f.x} cy={f.y - 20} r="10" className="ps-line" /><text x={f.x} y={f.y - 16} className="ps-q">?</text></g>
    </g>)}
  </g>;
}

export function TeacherGraphic() {
  return <svg className="ps-svg ps-teacher" viewBox="0 0 400 240" role="img" aria-label="One teacher facing forty students; one student's question goes unanswered">
    <AntUse cx={200} base={46} h={44} className="ps-ant" />
    <text x="200" y="64" className="ps-label">Teacher</text>
    <Crowd dots={wide} focus={25} cls="ps-wide" />
    <Crowd dots={narrow} focus={21} cls="ps-narrow" />
  </svg>;
}

const lanes = [{ y: 60, label: "Needs more time", cls: "behind" }, { y: 130, label: "Right on pace", cls: "even" }, { y: 200, label: "Ready for more", cls: "ahead" }];
export function PaceGraphic() {
  return <svg className="ps-svg ps-pace" viewBox="0 0 400 240" role="img" aria-label="Class pace sweeps at one speed while three students need different speeds">
    {lanes.map((l) => <g key={l.cls}>
      <text x="30" y={l.y - 16} className="ps-label ps-start">{l.label}</text>
      <line x1="30" y1={l.y} x2="362" y2={l.y} className="ps-track" />
      {l.cls === "behind" && <line x1="30" y1={l.y} x2="230" y2={l.y} className="ps-trail" />}
      <g className={`ps-orb ps-${l.cls}`}>
        <AntUse cx={30} base={l.y} h={20} pose="walk" className={`ps-ant aw aw-${l.cls === "ahead" ? "paceAhead" : "pace"}`} />
        <AntUse cx={30} base={l.y} h={20} pose={l.cls === "ahead" ? "wave" : "static"} className={`ps-ant ar ar-${l.cls === "ahead" ? "paceAhead" : "pace"}`} />
      </g>
    </g>)}
    <line x1="362" y1="34" x2="362" y2="212" className="ps-line" /><path d="M362 34 L382 40 L362 46 Z" className="ps-fill" />
    <text x="392" y="232" className="ps-label ps-end">End of chapter</text>
    <g className="ps-sweep"><line x1="30" y1="22" x2="30" y2="212" className="ps-line thin" /><text x="30" y="14" className="ps-label">Class pace</text></g>
  </svg>;
}

export function ShiftGraphic() {
  return <svg className="ps-svg" viewBox="0 0 400 240" role="img" aria-label="The same student, disengaged with a textbook page, then engaged with an interactive lesson">
    <text x="100" y="24" className="ps-label">Then</text><text x="300" y="24" className="ps-label">Now</text>
    <line x1="200" y1="14" x2="200" y2="226" className="ps-line thin dotted" />
    <rect x="40" y="36" width="120" height="146" rx="10" className="ps-line" />
    {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1="56" y1={62 + i * 20} x2={i % 2 ? 128 : 144} y2={62 + i * 20} className="ps-track" />)}
    <rect x="50" y="54" width="100" height="16" rx="3" className="pv nw-hl" />
    <rect x="225" y="36" width="150" height="146" rx="14" className="ps-line" />
    <g className="nw-logo"><svg x="262" y="44" width="76" height="13" viewBox={logoViewBox("wordmark")} aria-hidden="true" dangerouslySetInnerHTML={{ __html: NOW_LOGO }} /></g>
    <g className="nw-tri"><path d="M245 120 L305 120 L245 76 Z" pathLength="1" className="ps-line nw-draw" /><path d="M291 120 A14 14 0 0 0 294 112" pathLength="1" className="ps-line thin nw-draw nw-d2" /></g>
    <line x1="245" y1="140" x2="355" y2="140" className="ps-track" />
    <circle cx="255" cy="140" r="6" className="ps-fill pv nw-knob" />
    <rect x="245" y="152" width="50" height="22" rx="6" className="ps-line thin" />
    <rect x="305" y="152" width="50" height="22" rx="6" className="ps-line thin" />
    <rect x="305" y="152" width="50" height="22" rx="6" className="ps-fill nw-tap" />
    <path d="M322 163 l5 5 l9 -10" pathLength="1" className="sa-tick-dark nw-draw nw-d3" />
    <g className="nw-dots">{[0, 1, 2].map((i) => <circle key={i} cx={120 + i * 8} cy="210" r="2" className={`ps-fill dim nw-dot nw-dot${i}`} />)}</g>
    <g className="pv nw-orb">
      <g className="nw-dim">
        <text x="82" y="216" className="ps-label small ps-end nw-bored">{MOOD.before}</text>
        <AntUse cx={100} base={222} h={30} className="ps-ant ps-ant-dim ar ar-shift" /><AntUse cx={100} base={222} h={30} pose="walk" className="ps-ant ps-ant-dim aw aw-shift" />
      </g>
      <g className="nw-bright">
        <g className="nw-hop">
          <AntUse cx={100} base={222} h={30} pose="walk" className="ps-ant aw aw-shift" /><AntUse cx={100} base={222} h={30} className="ps-ant ar ar-shift" />
          <path d="M107 193l3-5M112 197l5-2" className="nw-spark" />
        </g>
        <text x="120" y="216" className="ps-label small ps-start nw-happy">{MOOD.after}</text>
      </g>
    </g>
  </svg>;
}

const posts = [
  { x: 60, y: 210, s: 1, t: "Chapter 1", k: 1 },
  { x: 300, y: 165, s: 0.85, t: "Chapter 2", k: 2 },
  { x: 128, y: 130, s: 0.75, t: "Chapter 3", k: 3 },
  { x: 262, y: 106, s: 0.65, t: "Chapter 4", k: 4 },
  { x: 158, y: 88, s: 0.6, t: "Chapter 5", k: 5 },
];
export function PathGraphic() {
  return <svg className="ps-svg" viewBox="0 0 400 240" role="img" aria-label="A road where a short headlight shows only the next chapter, until a lantern reveals the chapters ahead">
    <defs><filter id="ps-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" /></filter></defs>
    <line x1="60" y1="232" x2="190" y2="70" className="ps-line" /><line x1="340" y1="232" x2="210" y2="70" className="ps-line" />
    <line x1="200" y1="232" x2="200" y2="74" className="ps-line thin dotted" />
    {posts.map((p) => <g key={p.k} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
      <line x1="0" y1="0" x2="0" y2="-30" className="ps-line" />
      <rect x="-36" y="-50" width="72" height="20" rx="4" className="ps-line" />
      <g className={`rd-q rd-q${p.k}`}><text x="0" y="-35" className="ps-q">?</text></g>
      <g className={`rd-l rd-l${p.k}`}><text x="0" y="-36" className="ps-label small">{p.t}</text></g>
    </g>)}
    <g className="pv rd-orb">
      <path d="M200 222 L168 150 L232 150 Z" className="rd-cone" />
      <g className="rd-lantern"><rect x="194" y="194" width="12" height="14" rx="3" className="ps-line thin" /><path d="M196 194 q4 -6 8 0" className="ps-line thin" /></g>
      <g className="rd-ask"><text x="200" y="200" className="ps-q">?</text></g>
      <AntUse cx={200} base={230} h={22} pose="walk" className="ps-ant aw aw-path" /><AntUse cx={200} base={230} h={22} className="ps-ant ar ar-path" />
    </g>
    <g className="pv rd-mist" filter="url(#ps-blur)" opacity="0.5">
      <circle cx="175" cy="78" r="30" fill="#404040" /><circle cx="215" cy="70" r="34" fill="#525252" /><circle cx="250" cy="86" r="28" fill="#737373" /><circle cx="150" cy="92" r="26" fill="#5c5c5c" />
    </g>
  </svg>;
}

export const PROBLEM_GRAPHICS: Record<string, { graphic: ReactNode; caption: ReactNode }> = {
  dots: { graphic: <TeacherGraphic />, caption: "Every child learns differently." },
  pace: { graphic: <PaceGraphic />, caption: <span className="ps-timed">Same lesson. Different needs.</span> },
  device: { graphic: <ShiftGraphic />, caption: "Same child. Different world. Lessons should meet them there." },
  path: { graphic: <PathGraphic />, caption: <span className="rd-caps"><span className="rd-cap1">Most families only see one chapter ahead.</span><span className="rd-cap2">Knowing what's next changes everything.</span></span> },
};
