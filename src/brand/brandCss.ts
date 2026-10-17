// Logo + splash CSS and the tiny <head> script, generated from TIMING so no duration is hard-coded.
// Both are inlined in the server-rendered shell (__root.tsx) so the splash paints on the first frame.
// Animations use transform and opacity only.
import { TIMING } from "@/config/timing";
import { sceneAt } from "./antScene";

const S = TIMING.splash;
const A = TIMING.ant;
const H = TIMING.highlight;
const R = TIMING.roamer;
const L = TIMING.logo;
const s = (n: number) => `${+n.toFixed(3)}s`;

export const SPLASH_STORAGE_KEY = "stoodant-splash";

/** How long the splash runs for each version, in ms (React removes the node after this). */
export function splashDurationMs(version: "high" | "low" | "reduced") {
  const total = version === "reduced" ? S.reducedHold : version === "low" ? S.lowLiftAt + S.lowLift : S.liftAt + S.lift;
  return total * 1000;
}

/**
 * Runs before first paint: picks the perf tier (?perf=low|high overrides), and marks repeat
 * loads in this session so the splash never flashes again. Tap or any key skips the splash.
 */
export const HEAD_SCRIPT = `(function(){var d=document.documentElement,m=function(q){return matchMedia(q).matches},n=navigator,p=null;try{p=new URLSearchParams(location.search).get("perf")}catch(e){}
var low=p?p==="low":m("(pointer: coarse)")||innerWidth<1024||(n.hardwareConcurrency||8)<=4||(n.deviceMemory||8)<=4||!!(n.connection&&n.connection.saveData)||m("(prefers-reduced-motion: reduce)");
d.setAttribute("data-perf",low?"low":"high");
try{if(sessionStorage.getItem("${SPLASH_STORAGE_KEY}"))d.setAttribute("data-splash","off");else sessionStorage.setItem("${SPLASH_STORAGE_KEY}","1")}catch(e){}
var skip=function(){var el=document.getElementById("splash");if(el)el.classList.add("is-skip")};addEventListener("pointerdown",function(e){if(e.target&&e.target.closest&&e.target.closest("#splash"))skip()});addEventListener("keydown",skip,{once:true})})()`;

/**
 * Story-slide ants: a walking copy (.aw-*) and a resting copy (.ar-*) of the same <use>, swapped by opacity
 * so legs move only while the slide moves the ant. Plays with the slide's own keyframes.
 */
function slideAntSwaps() {
  return Object.entries(TIMING.slideAnts)
    .map(([name, { length, walk: [from, to] }]) => {
      const lead = (on: number) => (from ? `,${from - 0.1}%{opacity:${1 - on}}${from}%` : "");
      return (
        `.ass:not(.is-reduced) .is-active .aw-${name}{animation:ant-walk-${name} ${s(length)} infinite}` +
        `.ass:not(.is-reduced) .is-active .ar-${name}{animation:ant-rest-${name} ${s(length)} infinite}` +
        `@keyframes ant-walk-${name}{0%${lead(1)},${to - 0.1}%{opacity:1}${to}%,100%{opacity:0}}` +
        `@keyframes ant-rest-${name}{0%${lead(0)},${to - 0.1}%{opacity:0}${to}%,100%{opacity:1}}`
      );
    })
    .join("\n");
}

const letterDelay =(base: number, stagger: number) => `calc(${s(base)} + var(--i, 0) * ${s(stagger)})`;
const blinkPct = (L.blink / L.blinkEvery) * 100;

export const BRAND_CSS = `
.brand-logo{display:block;width:100%;height:auto;overflow:visible}
.brand-logo .lg-letter,.brand-logo .lg-eyeball,.brand-logo .lg-look,.brand-logo .lg-spark,.brand-logo .lg-stripe,.brand-logo .lg-triangle{transform-box:fill-box;transform-origin:50% 50%}
.brand-logo .lg-letter{transform-origin:50% 100%}
.brand-logo .lg-stripe{transform-origin:0 50%}
.brand-logo .lg-spark{transform-origin:50% 100%}
.brand-logo .lg-look{transition:transform ${s(L.pupilEase)} ease-out}
html[data-perf=high] .lg-anim-blink .lg-eyeball{animation:lg-blink ${s(L.blinkEvery)} ${s(L.blinkEvery / 2)} infinite}
.lg-anim-blink.is-paused .lg-eyeball{animation-play-state:paused}
@keyframes lg-blink{0%,${(100 - blinkPct).toFixed(2)}%,100%{transform:none}${(100 - blinkPct / 2).toFixed(2)}%{transform:scaleY(.1)}}
@media (hover:hover) and (pointer:fine){.logo:hover .lg-letter{animation:lg-wave ${s(L.wave)} ${letterDelay(0, L.waveStagger)} ease-out}}
@keyframes lg-wave{0%,100%{transform:none}40%{transform:translateY(-18px)}}

#splash{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:24px;background:#fff;cursor:pointer;animation:splash-lift ${s(S.lift)} ${s(S.liftAt)} cubic-bezier(.7,0,.3,1) forwards}
#splash .brand-logo{width:min(80vw,520px)}
#splash.is-skip{animation:splash-lift ${s(S.skipLift)} cubic-bezier(.7,0,.3,1) forwards}
html[data-splash=off] #splash{display:none}
@keyframes splash-lift{to{transform:translateY(-100%);opacity:0}}
.lg-anim-intro .lg-letter{opacity:0;animation:sp-jump ${s(S.letterJump)} ${letterDelay(S.letterStart, S.letterStagger)} linear both}
.lg-anim-intro .lg-eyeball{animation:sp-pop ${s(S.pop)} ${s(S.eyesPop)} cubic-bezier(.3,1.6,.5,1) both,lg-blink-once ${s(S.blink)} ${s(S.blinkAt)}}
.lg-anim-intro .lg-look{animation:sp-glance ${s(S.glance)} ${s(S.glanceAt)} ease-in-out}
.lg-anim-intro .lg-spark{animation:sp-pop ${s(S.pop)} ${letterDelay(S.sparksAt, S.accentStagger)} cubic-bezier(.3,1.6,.5,1) both}
.lg-anim-intro .lg-stripe{animation:sp-wipe ${s(S.pop)} ${s(S.stripeAt)} ease-out both}
.lg-anim-intro .lg-triangle{animation:sp-pop ${s(S.pop)} ${s(S.triangleAt)} cubic-bezier(.3,1.6,.5,1) both}
.lg-anim-intro .lg-phrase{animation:sp-fade ${s(S.phraseFade)} ${letterDelay(S.taglineAt, S.phraseStagger)} ease-out both}
@keyframes sp-jump{0%{opacity:0;transform:translateY(70px) scale(1,.9);animation-timing-function:cubic-bezier(.2,.8,.4,1)}12%{opacity:1}45%{transform:translateY(-26px) scale(.9,1.14);animation-timing-function:cubic-bezier(.6,0,.9,.5)}68%{transform:translateY(0) scale(1.14,.84)}84%{transform:translateY(-4px) scale(.97,1.04)}100%{opacity:1;transform:none}}
@keyframes sp-pop{0%{transform:scale(0)}100%{transform:none}}
@keyframes sp-wipe{0%{transform:scaleX(0)}100%{transform:none}}
@keyframes sp-fade{0%{opacity:0}100%{opacity:1}}
@keyframes lg-blink-once{0%,100%{transform:none}50%{transform:scaleY(.1)}}
@keyframes sp-glance{0%,100%{transform:none}30%,40%{transform:translateX(-13px)}65%,75%{transform:translateX(13px)}}

html[data-perf=low] #splash{animation-duration:${s(S.lowLift)};animation-delay:${s(S.lowLiftAt)}}
html[data-perf=low] #splash.is-skip{animation-duration:${s(S.skipLift)};animation-delay:0s}
html[data-perf=low] #splash .brand-logo{animation:sp-fade ${s(S.lowFade)} ease-out both}
html[data-perf=low] .lg-anim-intro :is(.lg-letter,.lg-look,.lg-spark,.lg-stripe,.lg-triangle,.lg-phrase){animation:none;opacity:1}
html[data-perf=low] .lg-anim-intro .lg-eyeball{animation:lg-blink-once ${s(S.blink)} ${s(S.lowBlinkAt)}}

@media (prefers-reduced-motion: reduce){
#splash,html[data-perf] #splash{animation:sp-gone 1ms ${s(S.reducedHold)} forwards}
#splash .brand-logo,.lg-anim-intro *,.lg-anim-blink .lg-eyeball{animation:none!important;opacity:1!important}
.brand-logo .lg-look{transition:none}
}
@keyframes sp-gone{to{opacity:0;visibility:hidden}}

.ant{overflow:visible;--ant-walk:paused;--ant-wave:paused}
.ant-walk{--ant-walk:running}
.ant-wave{--ant-wave:running}
.ant-legs-a,.ant-legs-b,.ant-wave-leg,.ant-body{transform-box:view-box;transform-origin:35px 30px}
.ant-wave-leg{transform-origin:40px 30px}
.ant-legs-a{animation:ant-step ${s(A.step)} linear infinite;animation-play-state:var(--ant-walk,paused)}
.ant-legs-b{animation:ant-step ${s(A.step)} linear ${s(-A.step / 2)} infinite;animation-play-state:var(--ant-walk,paused)}
.ant-body{animation:ant-bob ${s(A.step / 2)} ease-in-out infinite alternate;animation-play-state:var(--ant-walk,paused)}
.ant-wave-leg{animation:ant-wave ${s(A.wave)} ease-in-out infinite alternate;animation-play-state:var(--ant-wave,paused)}
.ant-celebrate{transform-box:fill-box;transform-origin:50% 100%;animation:ant-hop ${s(A.hop)} cubic-bezier(.3,1.4,.5,1) 2}
@keyframes ant-step{0%,100%{transform:none}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
@keyframes ant-bob{to{transform:translateY(-1.5px)}}
@keyframes ant-wave{0%{transform:none}40%{transform:rotate(-100deg)}100%{transform:rotate(-70deg)}}
@keyframes ant-hop{0%,100%{transform:none}35%{transform:translateY(-8px) scale(.95,1.06)}70%{transform:translateY(0) scale(1.06,.94)}}
html:not([data-perf=high]) .ant{--ant-walk:paused;--ant-wave:paused}
html:not([data-perf=high]) .ant-celebrate{animation:none}
@media (prefers-reduced-motion: reduce){.ant{--ant-walk:paused;--ant-wave:paused}.ant-celebrate{animation:none}}

.ant-trail{height:90px;display:grid;place-items:center;margin-bottom:-90px;color:var(--ink)}
.ant-trail svg{width:min(320px,72vw);height:auto;overflow:visible}
.ant-trail-dots{stroke:#d4d4d4;stroke-width:1;stroke-dasharray:1 6}
.ant-trail.inverse{color:#f5f5f5}.ant-trail.inverse .ant-trail-dots{stroke:#404040}
.ant-trail.is-waiting .ant-trail-walker{transform:translateX(-130px);opacity:0}
.ant-trail.is-walking .ant-trail-walker{animation:ant-cross ${s(A.trailWalk)} cubic-bezier(.3,.1,.4,1) both}
.ant-trail.is-walking .ant{--ant-walk:running}
@keyframes ant-cross{0%{transform:translateX(-130px);opacity:0}12%{opacity:1}100%{transform:none;opacity:1}}

.cta-scene{margin:48px 0 0;width:min(100%,560px)}
.cta-scene-svg{display:block;width:100%;height:auto;overflow:visible;color:#f5f5f5}
.cta-scene-path{stroke:#d4d4d4;stroke-width:2;stroke-linecap:round;stroke-dasharray:0 9}
.cta-flag-pole{stroke:#d4d4d4;stroke-width:2;stroke-linecap:round}
.cta-flag-cloth{fill:#f5f5f5;transform-box:fill-box;transform-origin:0 50%}
.cta-walker{transform-box:view-box}
.cta-sparks{fill:none;stroke:var(--amber);stroke-width:2.5;stroke-linecap:round}
.cta-sparks path{transform-box:fill-box;transform-origin:0 100%;animation:sp-pop ${s(A.sparkPop)} cubic-bezier(.3,1.6,.5,1) both}
.cta-scene-svg.is-animated .cta-walker{animation:cta-walk ${s(A.ctaLoop)} linear infinite}
.cta-scene-svg.is-paused .cta-walker{animation-play-state:paused}
.cta-scene-svg.is-paused .ant{--ant-walk:paused}
.cta-scene-svg.is-animated.is-arrived .cta-flag-cloth{animation:flag-wave ${s(A.flagWave)} ease-in-out 4 alternate}
.cta-scene-caption{margin:16px 0 0;color:#a3a3a3;font-size:14px;line-height:1.5}
@keyframes cta-walk{0%{transform:${sceneAt(0)};opacity:0}6%{opacity:1}70%{transform:${sceneAt(0.72)};opacity:1}78%,100%{transform:${sceneAt(0.72)};opacity:0}}
@keyframes flag-wave{0%{transform:none}100%{transform:skewY(-8deg) scaleX(.9)}}
@media (max-width:1199px){.cta-scene{width:min(100%,480px)}}
@media (max-width:767px){.cta-scene{width:100%;margin:24px auto 0}}

.ps-ant{color:var(--ass-1, #f5f5f5)}
.ps-ant-dim{color:#737373;--ant-eye:#737373}
.ps-ant-school{color:#737373;--ant-eye:#737373}
.aw{opacity:0}
${slideAntSwaps()}

.au-leg-l,.au-leg-r,.au-arm-l,.au-arm-r,.au-body{transform-box:view-box}
.au-leg-l{transform-origin:36px 77px;animation:au-step ${s(R.step)} linear infinite;animation-play-state:var(--ant-walk,paused)}
.au-leg-r{transform-origin:44px 77px;animation:au-step ${s(R.step)} linear ${s(-R.step / 2)} infinite;animation-play-state:var(--ant-walk,paused)}
.au-arm-r{transform-origin:47px 48px;animation:au-step ${s(R.step)} linear infinite;animation-play-state:var(--ant-walk,paused)}
.au-body{animation:ant-bob ${s(R.step / 2)} ease-in-out infinite alternate;animation-play-state:var(--ant-walk,paused)}
.au-arm-l{transform-origin:33px 47px;animation:au-wave ${s(R.step * 1.5)} ease-in-out infinite alternate;animation-play-state:var(--ant-wave,paused)}
@keyframes au-step{0%,100%{transform:none}25%{transform:rotate(14deg)}75%{transform:rotate(-14deg)}}
@keyframes au-wave{to{transform:rotate(-28deg)}}
.roamer{position:fixed;left:0;bottom:10px;z-index:85;width:64px;visibility:hidden;transform:translate(0,110%)}
.roamer.is-shown{visibility:visible}
.roamer.is-walking .ant{--ant-walk:running}
.roamer.is-talking .ant{--ant-wave:running}
.roamer-ant{display:block;width:100%;padding:0;border:0;background:none;color:var(--ink);cursor:pointer}
.roamer-ant svg{display:block;width:100%;height:auto;overflow:visible}
.roamer-bubble{position:absolute;bottom:100%;left:0;margin-bottom:4px;width:max-content;max-width:min(240px,calc(100vw - 16px))}
.roamer.is-right .roamer-bubble{left:auto;right:0}
.roamer-bubble:empty{display:none}
.roamer-bubble p{margin:0;padding:10px 14px;border:1px solid #e5e5e5;border-radius:16px;background:#fff;color:#0a0a0a;font-size:13px;line-height:1.45;box-shadow:0 8px 24px rgba(10,10,10,.12)}
.roamer-bubble a{display:block;margin-top:6px;font-weight:600;text-decoration:underline}
@media (max-width:767px){.roamer{width:52px}}

.hl{position:relative;display:inline-block;isolation:isolate;white-space:nowrap}
.hl-swoosh{position:absolute;z-index:-1;left:-.08em;width:calc(100% + .16em);top:.4em;height:.6em;overflow:visible}
.hl-swoosh path{fill:none;stroke:var(--amber);stroke-width:30;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1}
.hl.is-static .hl-swoosh path{stroke-dashoffset:0}
.hl.is-drawn .hl-swoosh path{animation:hl-draw ${s(H.draw / 2)} linear calc(var(--hl-delay, 0s) + var(--hl-splash, 0s)) forwards}
html[data-perf=high]:not([data-splash=off]) .hero .hl{--hl-splash:${s(S.liftAt + S.lift)}}
.hl-join .hl-swoosh{width:calc(100% + .42em)}
.hl-dark .hl-swoosh{top:.08em;height:.94em}
.hl-dark .hl-swoosh path{stroke-width:40}
.hl-dark{transition:color .15s calc(var(--hl-delay, 0s) + ${s(H.draw / 2)})}
.hl-dark.is-drawn,.hl-dark.is-static{color:var(--ink)}
@keyframes hl-draw{to{stroke-dashoffset:0}}
`.trim();
