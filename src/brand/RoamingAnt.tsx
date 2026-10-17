import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { TIMING } from "@/config/timing";
import { ANT_UPRIGHT_ID } from "./AntUpright";

type Message = (typeof SITE_CONFIG.mascot.messages)[number];
const T = TIMING.roamer;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * The roaming student ant. Now and then it pops up from the bottom edge, walks a little and leaves.
 * Tapping it shows a short message (shuffled, no repeats until all are used).
 * High tier: pops and walks (transform only). Low tier / reduced motion: simply appears and disappears.
 * It stays away while the demo form or footer is on screen, and never covers the WhatsApp button.
 */
export function RoamingAnt() {
  const wrap = useRef<HTMLDivElement>(null);
  const flip = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const talkUntil = useRef(0);
  const deck = useRef<number[]>([]);
  const blocked = useRef(false);

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
    let current: Animation | null = null;
    const html = document.documentElement;
    const motion = () => html.getAttribute("data-perf") === "high" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = async (from: string, to: string, seconds: number, easing = "linear") => {
      current = el.animate([{ transform: from }, { transform: to }], { duration: seconds * 1000, easing, fill: "forwards" });
      try { await current.finished; } catch { /* cancelled on unmount */ }
    };
    const onVisibility = () => { if (!current) return; if (document.hidden) current.pause(); else if (current.playState === "paused") current.play(); };
    document.addEventListener("visibilitychange", onVisibility);

    const round = async () => {
      const size = el.offsetWidth || 64;
      const vw = window.innerWidth;
      const left = 12;
      const right = vw - size - (vw < 768 ? 76 : 96); // leave room for the WhatsApp button
      if (right <= left + size) return;
      const x0 = rand(left, right);
      const x1 = Math.min(right, Math.max(left, x0 + rand(-1, 1) * Math.min(260, vw * 0.4)));
      const animated = motion();
      el.classList.remove("is-walking");
      el.classList.toggle("is-right", x1 > vw / 2);
      if (flip.current) flip.current.style.transform = x1 < x0 ? "scaleX(-1)" : "";
      setShown(true);
      if (animated) {
        await move(`translate(${x0}px,110%)`, `translate(${x0}px,0)`, T.pop, "cubic-bezier(.3,1.5,.5,1)");
        if (!alive) return;
        el.classList.add("is-walking");
        await move(`translate(${x0}px,0)`, `translate(${x1}px,0)`, Math.abs(x1 - x0) / T.speed);
        el.classList.remove("is-walking");
      } else {
        el.style.transform = `translate(${x1}px,0)`;
      }
      // Stand around; stay longer while it is talking; leave early if the form or footer comes into view.
      const until = Date.now() + T.stay * 1000;
      while (alive && !blocked.current && (Date.now() < until || Date.now() < talkUntil.current || document.hidden)) await wait(250);
      if (!alive) return;
      setMessage(null);
      if (animated) await move(`translate(${x1}px,0)`, `translate(${x1}px,110%)`, T.pop, "ease-in");
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
      current?.cancel();
      document.removeEventListener("visibilitychange", onVisibility);
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
    const messages = SITE_CONFIG.mascot.messages;
    if (!deck.current.length) deck.current = messages.map((_, i) => i).sort(() => Math.random() - 0.5);
    const next = messages[deck.current.pop() ?? 0];
    if (next) setMessage(next);
    talkUntil.current = Date.now() + T.bubbleHold * 1000;
    const el = wrap.current;
    if (!el) return;
    el.classList.add("is-talking");
    window.setTimeout(() => { if (Date.now() >= talkUntil.current) { el.classList.remove("is-talking"); setMessage(null); } }, T.bubbleHold * 1000 + 50);
  };

  return (
    <div ref={wrap} className={`roamer${shown ? " is-shown" : ""}`} aria-hidden={!shown || undefined}>
      <div ref={bubble} className="roamer-bubble" role="status" aria-live="polite">
        {message && (
          <p>
            {message.text}
            {"link" in message && message.link && <a href={message.link.href} tabIndex={shown ? 0 : -1}>{message.link.label}</a>}
          </p>
        )}
      </div>
      <button type="button" className="roamer-ant" onClick={talk} tabIndex={shown ? 0 : -1} aria-label={SITE_CONFIG.mascot.roamerLabel}>
        <div ref={flip} className="roamer-flip">
          <svg viewBox="0 0 80 100" className="ant" aria-hidden="true">
            <use href={`#${ANT_UPRIGHT_ID}`} width="80" height="100" />
          </svg>
        </div>
      </button>
    </div>
  );
}
