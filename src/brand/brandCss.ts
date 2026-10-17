// Logo + splash CSS and the tiny <head> script, generated from TIMING so no duration is hard-coded.
// Both are inlined in the server-rendered shell (__root.tsx) so the splash paints on the first frame.
// Animations use transform and opacity only.
import { TIMING } from "@/config/timing";

const S = TIMING.splash;
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

const letterDelay = (base: number, stagger: number) => `calc(${s(base)} + var(--i, 0) * ${s(stagger)})`;
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
`.trim();
