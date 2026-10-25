import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MASCOT_MESSAGES } from "@/config/mascotConfig";
import { SITE_CONFIG } from "@/config/siteConfig";
import { TIMING } from "@/config/timing";
import "./roamer.css";

type Messages = typeof MASCOT_MESSAGES;
type Message = Messages[keyof Messages][number];
// Which messages fit which part of the page.
const SECTIONS: [selector: string, key: Exclude<keyof Messages, "general">][] = [
  [".hero", "hero"], [".problem-slides", "problem"], [".gap-section", "gap"], [".process-section", "process"],
  [".ahead-slides", "ahead"], [".pricing-section", "batches"], [".comparison-section", "why"], [".subjects-section", "subjects"],
  [".teachers-section", "teachers"], [".progress-section", "progress"], [".testimonials-section", "testimonials"], [".faq-section", "faq"],
];
const shuffled = (n: number) => Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);

/** The section in the middle of the screen, if any. */
function currentSection(): Exclude<keyof Messages, "general"> | null {
  for (const el of document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2)) {
    const section = el.closest("section");
    if (!section) continue;
    for (const [selector, key] of SECTIONS) if (section.matches(selector)) return key;
  }
  return null;
}
const T = TIMING.roamer;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const pick = <V,>(list: readonly [V, ...V[]]) => list[Math.floor(Math.random() * list.length)] ?? list[0];

// The mascot's pictures (public/mascot/, cut from the character sheet). The standing figure is three
// layers on one canvas (two legs behind the body) so the legs can step and kick on their own.
const IMG = "/mascot/";
const FIGURE = ["leg-l", "leg-r", "body"] as const;
const FACES = ["wink", "think"] as const;
const LOW_POSES = ["rest", "read"] as const;
type Face = (typeof FACES)[number];
type LowPose = (typeof LOW_POSES)[number];
const decode = (names: readonly string[]) =>
  Promise.all(names.map((n) => { const img = new Image(); img.src = `${IMG}${n}.webp`; return img.decode().catch(() => undefined); }));

// Dance moves, played on the whole figure (feet stay on the ground line) while the legs kick.
// Each step eases out into an extreme and eases in away from it, so the motion swings like a pendulum
// instead of stopping at every keyframe.
const OUT = "cubic-bezier(.33,1,.68,1)";
const IN = "cubic-bezier(.32,0,.67,0)";
const swing = (a: string, b: string): Keyframe[] => [
  { transform: "none", easing: OUT }, { transform: a, easing: IN }, { transform: "none", easing: OUT }, { transform: b, easing: IN }, { transform: "none" },
];
const DANCES: [Keyframe[], ...Keyframe[][]] = [
  // Bounce: squash, spring up, land soft.
  [{ transform: "none", easing: OUT }, { transform: "scale(1.05,.95)", offset: .2, easing: OUT }, { transform: "translateY(-14%) scale(.98,1.03)", offset: .55, easing: IN }, { transform: "scale(1.04,.96)", offset: .85, easing: OUT }, { transform: "none" }],
  // Sway
  swing("rotate(-8deg)", "rotate(8deg)"),
  // Spin
  [{ transform: "none", easing: OUT }, { transform: "translateY(-8%) scaleX(-1)", easing: IN }, { transform: "none" }],
  // Shuffle
  swing("translateX(-12%) skewX(5deg)", "translateX(12%) skewX(-5deg)"),
];

/**
 * The roaming Stoodant ant. Now and then it moonwalks in from a side of the screen, dances, shares a
 * tip for the section on screen, then moonwalks out. Tapping it shows another tip (shuffled, no repeats
 * until all are used). High tier: transform-only animations. Low tier / reduced motion: a resting or
 * reading pose simply appears at the bottom edge with its tip and disappears.
 * It stays away while the demo form or footer is on screen, and never stops on the WhatsApp button.
 */
export function RoamingAnt() {
  const wrap = useRef<HTMLDivElement>(null);
  const fig = useRef<HTMLDivElement>(null);
  const flip = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [low, setLow] = useState<LowPose | null>(null);
  const [face, setFace] = useState<Face>("wink");
  const [message, setMessage] = useState<Message | null>(null);
  const talkUntil = useRef(0);
  const decks = useRef<Partial<Record<keyof Messages, number[]>>>({});
  const blocked = useRef(false);
  const talkRef = useRef<() => void>(() => {});

  // Keep clear of the demo form and the footer.
  useEffect(() => {
    const targets = [document.querySelector("#demo .form-wrap"), document.querySelector("footer")].filter(Boolean) as Element[];
    const seen = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
      blocked.current = seen.size > 0;
    });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let alive = true;
    const html = document.documentElement;
    const motion = () => html.getAttribute("data-perf") === "high" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const play = async (target: HTMLElement | null, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      if (!target) return;
      try { await target.animate(frames, options).finished; } catch { /* cancelled on unmount */ }
    };
    // Eases in and out so the glide starts and stops softly. A shorter-than-usual min is a fixed, quick exit.
    const glide = (from: number, to: number, min: number) =>
      play(el, [{ transform: `translate(${from}px,0)` }, { transform: `translate(${to}px,0)` }], { duration: (min < T.moonMin ? min : Math.max(min, Math.abs(to - from) / T.moonSpeed)) * 1000, easing: "cubic-bezier(.45,.05,.55,.95)", fill: "forwards" });
    // Moonwalk: face away from where it is going (the image faces right when not flipped) and lean back.
    const moonwalk = async (from: number, to: number, min: number = T.moonMin) => {
      const right = to > from;
      if (flip.current) flip.current.style.transform = right ? "scaleX(-1)" : "";
      el.style.setProperty("--lean", right ? "4deg" : "-4deg");
      el.classList.add("is-moonwalk");
      await glide(from, to, min);
      el.classList.remove("is-moonwalk");
    };
    const onVisibility = () => el.getAnimations({ subtree: true }).forEach((a) => (document.hidden ? a.pause() : a.play()));
    document.addEventListener("visibilitychange", onVisibility);
    // A tap anywhere else on the page sends it away at once: stop what it is doing where it stands.
    let gone = false;
    let at = 0;
    const onTapElsewhere = (e: PointerEvent) => {
      if (!el.classList.contains("is-shown") || gone || el.contains(e.target as Node)) return;
      gone = true;
      at = el.getBoundingClientRect().left;
      el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      el.style.transform = `translate(${at}px,0)`;
      el.classList.remove("is-moonwalk", "is-dance");
      talkUntil.current = 0;
    };
    document.addEventListener("pointerdown", onTapElsewhere, true);
    const stay = async () => {
      // Stay longer while it is talking; leave early if tapped away or the form or footer comes into view.
      const until = Date.now() + T.stay * 1000;
      while (alive && !gone && !blocked.current && (Date.now() < until || Date.now() < talkUntil.current || document.hidden)) await wait(250);
    };

    let lastDance = -1;
    const round = async () => {
      const vw = window.innerWidth;
      const animated = motion();
      const size = animated ? (vw < 768 ? 56 : 70) : (vw < 768 ? 84 : 96);
      const left = 12;
      const right = vw - size - (vw < 768 ? 76 : 96); // leave room for the WhatsApp button
      if (right <= left + size) return;
      const x1 = rand(left, Math.min(right, left + vw * 0.55));
      el.classList.toggle("is-right", x1 > vw / 2);
      setFace(pick(FACES));
      gone = false;

      if (!animated) {
        const pose = pick(LOW_POSES);
        await decode([pose, ...FACES]);
        if (!alive) return;
        setLow(pose);
        el.style.transform = `translate(${x1}px,0)`;
        setShown(true);
        talkRef.current();
        await stay();
        setMessage(null);
        setShown(false);
        return;
      }

      await decode([...FIGURE, ...FACES]);
      if (!alive) return;
      setLow(null);
      // Come in from the nearer side, gliding backwards.
      const fromLeft = x1 < vw / 2;
      const off = fromLeft ? -size - 20 : vw + 20;
      el.style.transform = `translate(${off}px,0)`;
      setShown(true);
      await moonwalk(off, x1);
      if (!alive) return;
      if (!gone) at = x1;

      // Dance (a different move from last time), then face the visitor and share a tip.
      if (flip.current) flip.current.style.transform = "";
      let d = Math.floor(Math.random() * DANCES.length);
      if (d === lastDance) d = (d + 1) % DANCES.length;
      lastDance = d;
      const beat = T.moonStep * 1000 * 1.6;
      if (!gone) el.classList.add("is-dance");
      if (!gone) await play(fig.current, DANCES[d] ?? DANCES[0], { duration: beat, iterations: Math.max(1, Math.round((T.dance * 1000) / beat)) });
      el.classList.remove("is-dance");
      if (!alive) return;
      if (!gone && !blocked.current) {
        talkRef.current();
        await stay();
      }
      if (!alive) return;
      setMessage(null);
      // Moonwalk out the way it came (quickly if it was tapped away).
      await moonwalk(at, off, gone ? T.moonMin / 2 : T.moonMin);
      setShown(false);
    };

    (async () => {
      await wait(T.firstDelay * 1000);
      while (alive) {
        if (!document.hidden && !blocked.current) await round();
        await wait(rand(T.minGap, T.maxGap) * 1000);
      }
    })();
    return () => {
      alive = false;
      el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", onTapElsewhere, true);
    };
  }, []);

  // Keep the bubble fully on screen.
  const bubble = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const b = bubble.current;
    if (!b || !message) return;
    b.style.transform = "";
    const r = b.getBoundingClientRect();
    const gutter = 8;
    const shift = r.right > window.innerWidth - gutter ? window.innerWidth - gutter - r.right : r.left < gutter ? gutter - r.left : 0;
    if (shift) b.style.transform = `translateX(${shift}px)`;
  }, [message]);

  const talk = () => {
    // A line for the section on screen first; once those are used up, a general one.
    const all = MASCOT_MESSAGES;
    const section = currentSection();
    let key: keyof Messages = "general";
    if (section && (decks.current[section] ??= shuffled(all[section].length)).length) key = section;
    else if (!decks.current.general?.length) decks.current.general = shuffled(all.general.length);
    const index = decks.current[key]?.pop() ?? 0;
    const next: Message | undefined = all[key][index];
    if (next) setMessage(next);
    talkUntil.current = Date.now() + T.bubbleHold * 1000;
    window.setTimeout(() => { if (Date.now() >= talkUntil.current) setMessage(null); }, T.bubbleHold * 1000 + 50);
  };
  talkRef.current = talk;

  return (
    <div
      ref={wrap}
      className={`roamer${shown ? " is-shown" : ""}${low ? " is-low" : ""}`}
      style={{ "--step": `${T.moonStep}s` } as CSSProperties}
      aria-hidden={!shown || undefined}
    >
      <div ref={bubble} className="roamer-bubble" role="status" aria-live="polite">
        {message && (
          <p>
            <img src={`${IMG}${face}.webp`} alt="" className="roamer-face" width="40" height="40" />
            <span>
              {message.text}
              {"link" in message && message.link && <a href={message.link.href} tabIndex={shown ? 0 : -1}>{message.link.label}</a>}
            </span>
          </p>
        )}
      </div>
      <button type="button" className="roamer-ant" onClick={talk} tabIndex={shown ? 0 : -1} aria-label={SITE_CONFIG.mascot.roamerLabel}>
        {low ? (
          <img src={`${IMG}${low}.webp`} alt="" />
        ) : (
          <div ref={fig} className="roamer-fig">
            <div ref={flip} className="roamer-flip">
              <div className="roamer-lean">
                {FIGURE.map((part) => <img key={part} src={shown ? `${IMG}${part}.webp` : undefined} alt="" className={`roamer-${part}`} />)}
              </div>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
