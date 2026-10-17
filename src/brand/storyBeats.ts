// Story slides (Problem, Stay Ahead): each graphic plays ONE clear beat in TIMING.story.beat seconds,
// then holds on its final frame (the resting state in styles.css). Transform and opacity only, except
// short stroke draws. Generated from TIMING so no duration is hard-coded; included in BRAND_CSS.
import { TIMING } from "@/config/timing";

const D = `${TIMING.story.beat}s`;
const PAIR = `${TIMING.realLifePair}s`;
const on = (cls: string, anim: string, easing = "linear") =>
  `.ass:not(.is-reduced) .ass-slide.is-active ${cls}{animation:${anim} ${D} ${easing} forwards}`;

export const STORY_CSS = [
  // Problem 1: the crowd appears, then one question, then a second, goes unanswered.
  on(".ps-wide,.ps-narrow", "b-crowd", "ease-out"),
  on(".ps-lit", "b-lit"),
  on(".ps-ask", "b-ask", "ease-out"),
  on(".ps-second .ps-lit", "b-lit2"),
  on(".ps-second .ps-ask", "b-ask2", "ease-out"),
  "@keyframes b-crowd{0%{opacity:0;transform:scale(.94)}25%,100%{opacity:1;transform:none}}",
  "@keyframes b-lit{0%,28%{opacity:0}36%,100%{opacity:1}}",
  "@keyframes b-ask{0%,30%{opacity:0;transform:scale(.4)}40%{opacity:1;transform:scale(1.2)}48%,100%{opacity:1;transform:none}}",
  "@keyframes b-lit2{0%,56%{opacity:0}64%,100%{opacity:1}}",
  "@keyframes b-ask2{0%,58%{opacity:0;transform:scale(.4)}68%{opacity:1;transform:scale(1.2)}76%,100%{opacity:1;transform:none}}",

  // Problem 2: class pace sweeps at one speed; the slow ant falls behind, the fast one arrives early and waits.
  on(".ps-sweep,.ps-even", "b-sweep"),
  on(".ps-behind", "b-behind"),
  on(".ps-ahead", "b-ahead", "cubic-bezier(.3,.6,.4,1)"),
  on(".ps-trail", "b-trail"),
  on(".ps-timed", "b-cap"),
  "@keyframes b-sweep{0%{transform:translateX(0)}85%,100%{transform:translateX(332px)}}",
  "@keyframes b-behind{0%{transform:translateX(0)}85%,100%{transform:translateX(200px)}}",
  "@keyframes b-ahead{0%{transform:translateX(0)}45%,100%{transform:translateX(332px)}}",
  "@keyframes b-trail{0%{transform:scaleX(0)}85%,100%{transform:scaleX(1)}}",
  "@keyframes b-cap{0%,70%{opacity:0}85%,100%{opacity:1}}",

  // Problem 3: bored with the page (Then), the ant moves to the interactive lesson (Now) and lights up.
  on(".nw-hl", "b-nw-hl"),
  on(".nw-dots", "b-nw-dots"),
  on(".nw-orb", "b-nw-orb", "cubic-bezier(.45,0,.25,1)"),
  on(".nw-dim", "b-nw-dim"),
  on(".nw-bright", "b-nw-bright"),
  on(".nw-draw", "b-nw-draw"),
  on(".nw-d2", "b-nw-draw2"),
  on(".nw-d3", "b-nw-draw3"),
  on(".nw-tri", "b-nw-tri", "cubic-bezier(.22,1,.36,1)"),
  on(".nw-knob", "b-nw-knob", "cubic-bezier(.22,1,.36,1)"),
  on(".nw-tap", "b-nw-tap"),
  "@keyframes b-nw-hl{0%{opacity:.15;transform:translateY(0)}25%{opacity:.15;transform:translateY(100px)}30%,100%{opacity:0;transform:translateY(100px)}}",
  "@keyframes b-nw-dots{0%,25%{opacity:1}30%,100%{opacity:0}}",
  "@keyframes b-nw-orb{0%,28%{transform:translate(0,0)}42%{transform:translate(100px,-36px)}55%,100%{transform:translate(200px,0)}}",
  "@keyframes b-nw-dim{0%,42%{opacity:1}52%,100%{opacity:0}}",
  "@keyframes b-nw-bright{0%,42%{opacity:0}52%,100%{opacity:1}}",
  "@keyframes b-nw-draw{0%,55%{stroke-dashoffset:1}68%,100%{stroke-dashoffset:0}}",
  "@keyframes b-nw-draw2{0%,62%{stroke-dashoffset:1}72%,100%{stroke-dashoffset:0}}",
  "@keyframes b-nw-draw3{0%,78%{stroke-dashoffset:1}88%,100%{stroke-dashoffset:0}}",
  "@keyframes b-nw-tri{0%,62%{transform:scale(1)}74%,100%{transform:scale(1.25)}}",
  "@keyframes b-nw-knob{0%,62%{transform:translateX(0)}74%,100%{transform:translateX(60px)}}",
  "@keyframes b-nw-tap{0%,78%{opacity:0;transform:scale(.9)}86%,100%{opacity:.9;transform:none}}",

  // Problem 4: walking the road, each sign is a "?" until the ant reaches it; then the lantern lights up what's ahead.
  on(".rd-orb", "b-rd-orb", "cubic-bezier(.45,0,.25,1)"),
  on(".rd-ask", "b-rd-ask"),
  on(".rd-q2", "b-rd-q2"), on(".rd-l2", "b-rd-l2"),
  on(".rd-q3", "b-rd-q3"), on(".rd-l3", "b-rd-l3"),
  on(".rd-q4,.rd-q5", "b-rd-qfar"), on(".rd-l4,.rd-l5", "b-rd-lfar"),
  on(".rd-lantern", "b-rd-lantern"),
  on(".rd-cone", "b-rd-cone", "cubic-bezier(.22,1,.36,1)"),
  on(".rd-cap1", "b-rd-cap1"),
  on(".rd-cap2", "b-rd-cap2"),
  "@keyframes b-rd-orb{0%,5%{transform:translateY(0)}60%,100%{transform:translateY(-80px)}}",
  "@keyframes b-rd-ask{0%,5%{opacity:0;transform:none}12%,45%{opacity:1;transform:none}55%,100%{opacity:0;transform:translateY(-12px)}}",
  "@keyframes b-rd-q2{0%,20%{opacity:1}26%,100%{opacity:0}}@keyframes b-rd-l2{0%,20%{opacity:0}26%,100%{opacity:1}}",
  "@keyframes b-rd-q3{0%,40%{opacity:1}46%,100%{opacity:0}}@keyframes b-rd-l3{0%,40%{opacity:0}46%,100%{opacity:1}}",
  "@keyframes b-rd-qfar{0%,68%{opacity:.5}76%,100%{opacity:0}}@keyframes b-rd-lfar{0%,68%{opacity:0}76%,100%{opacity:1}}",
  "@keyframes b-rd-lantern{0%,55%{opacity:0;transform:translateY(4px)}63%,100%{opacity:1;transform:none}}",
  "@keyframes b-rd-cone{0%,60%{transform:scale(1)}76%,100%{transform:scale(2.2,1.5)}}",
  "@keyframes b-rd-cap1{0%{opacity:0}8%,55%{opacity:1}62%,100%{opacity:0}}",
  "@keyframes b-rd-cap2{0%,60%{opacity:0}70%,100%{opacity:1}}",

  // Stay Ahead 1: the Stoodant ant hops two steps to the top; school pace arrives one step behind.
  on(".sa-orb", "b-sa-orb", "cubic-bezier(.45,0,.25,1)"),
  on(".sa-squash", "b-sa-squash"),
  on(".sa-school", "b-sa-school", "cubic-bezier(.22,1,.36,1)"),
  on(".sa-ripple", "b-sa-ripple", "ease-out"),
  on(".sa-ahead", "b-sa-ahead"),
  "@keyframes b-sa-orb{0%,5%{transform:translate(0,0)}15%{transform:translate(52px,-70px)}25%{transform:translate(105px,-50px)}38%{transform:translate(157px,-120px)}50%,100%{transform:translate(210px,-100px)}}",
  "@keyframes b-sa-squash{0%,4%{transform:scale(1)}6%{transform:scale(1.15,.85)}10%,14%{transform:scale(.9,1.12)}25%{transform:scale(1.12,.88)}29%{transform:scale(1)}32%{transform:scale(1.15,.85)}36%{transform:scale(.9,1.12)}50%{transform:scale(1.12,.88)}55%,100%{transform:scale(1)}}",
  "@keyframes b-sa-school{0%,40%{transform:translate(0,0)}52%{transform:translate(77px,-46px)}66%,100%{transform:translate(182px,-96px)}}",
  "@keyframes b-sa-ripple{0%,55%{opacity:0;transform:scale(1)}58%{opacity:.8;transform:scale(1)}85%,100%{opacity:0;transform:scale(2.2)}}",
  "@keyframes b-sa-ahead{0%,55%{opacity:0;transform:translateY(6px)}68%,100%{opacity:1;transform:none}}",

  // Stay Ahead 2: the ant previews chapters 4 and 5 while school reaches 2 and 3, which get revised.
  on(".sa-flag,.sa-orb2", "b-sa-flag", "cubic-bezier(.45,0,.25,1)"),
  on(".sa-prev4", "b-sa-in4"), on(".sa-prev5", "b-sa-in5"),
  on(".sa-ring2", "b-sa-ring2"), on(".sa-fill2", "b-sa-in2"), on(".sa-revise2", "b-sa-rev2"),
  on(".sa-ring3", "b-sa-ring3"), on(".sa-fill3", "b-sa-in3"), on(".sa-revise3", "b-sa-rev3"),
  "@keyframes b-sa-flag{0%,8%{transform:translateX(0)}25%,42%{transform:translateX(74px)}60%,100%{transform:translateX(148px)}}",
  "@keyframes b-sa-in4{0%,18%{opacity:0;transform:scale(.6)}26%,100%{opacity:1;transform:none}}",
  "@keyframes b-sa-in5{0%,52%{opacity:0;transform:scale(.6)}60%,100%{opacity:1;transform:none}}",
  "@keyframes b-sa-ring2{0%,24%{stroke-dashoffset:1}36%,100%{stroke-dashoffset:0}}",
  "@keyframes b-sa-in2{0%,28%{opacity:0;transform:scale(.6)}36%,100%{opacity:1;transform:none}}",
  "@keyframes b-sa-rev2{0%,28%{opacity:0}36%,100%{opacity:1}}",
  "@keyframes b-sa-ring3{0%,58%{stroke-dashoffset:1}70%,100%{stroke-dashoffset:0}}",
  "@keyframes b-sa-in3{0%,62%{opacity:0;transform:scale(.6)}70%,100%{opacity:1;transform:none}}",
  "@keyframes b-sa-rev3{0%,62%{opacity:0}70%,100%{opacity:1}}",

  // Stay Ahead 3: each concept-to-real-life pair draws in TIMING.realLifePair seconds.
  `.ass:not(.is-reduced) .ass-slide.is-active .as-pair .as-d{stroke-dasharray:1;animation:as-d ${PAIR} forwards}`,
  `.ass:not(.is-reduced) .ass-slide.is-active .as-pair .as-fade,.ass:not(.is-reduced) .ass-slide.is-active .as-pair foreignObject,.ass:not(.is-reduced) .ass-slide.is-active .as-concept-box{animation:b-pairin ${PAIR} forwards}`,
  "@keyframes b-pairin{0%{opacity:0}20%,100%{opacity:1}}",
  // Revised chapters keep their "Revise" label once shown.
  ".ps-svg .sa-revise{opacity:1}",
].join("\n");
