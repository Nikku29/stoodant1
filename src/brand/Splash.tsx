import { useEffect, useState, type CSSProperties } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { Logo } from "./Logo";
import { splashDurationMs } from "./splashTiming";

// Amber splashes that burst out from behind the eyes: offset from the centre (vmin), size (vmin), and shape.
const BLOBS = [
  { x: -34, y: -22, s: 34, r: "42% 58% 63% 37% / 41% 44% 56% 59%" },
  { x: 36, y: -18, s: 28, r: "58% 42% 38% 62% / 52% 61% 39% 48%" },
  { x: -26, y: 26, s: 24, r: "63% 37% 54% 46% / 55% 48% 52% 45%" },
  { x: 30, y: 28, s: 32, r: "40% 60% 45% 55% / 60% 40% 60% 40%" },
  { x: 2, y: -36, s: 18, r: "50% 50% 38% 62% / 44% 56% 44% 56%" },
];
// Small droplets thrown further out (vmin offset, px size); every third one is navy like the letters.
const DROPS = [
  [-46, -6, 14], [47, 4, 12], [-18, -42, 10], [22, -40, 12], [-40, 38, 10], [44, 40, 14], [-6, 44, 12], [12, 38, 8], [-50, 22, 8], [52, -30, 10],
] as const;
// Faint study doodles drifting at the edges.
const DOODLES = [
  { x: "8%", y: "12%", d: "M4 6h22v26H4zM9 12h12M9 18h12M9 24h8" },
  { x: "84%", y: "16%", d: "M6 30 28 8l4 4-22 22H6zM24 12l4 4" },
  { x: "10%", y: "78%", d: "M4 26h28M8 26V12M16 26V6M24 26V16" },
  { x: "86%", y: "76%", d: "M18 4a14 14 0 1 0 0.01 0M18 10v8l6 4" },
];

/**
 * Server-rendered splash: CSS keyframes play from the first paint, before any JS runs.
 * The <head> script hides it on repeat loads in a session and handles tap-to-skip.
 * React only removes the node once its animation has finished (or after mount + its duration).
 */
export function Splash() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const el = document.getElementById("splash");
    const html = document.documentElement;
    if (!el || html.getAttribute("data-splash") === "off") {
      setShow(false);
      return;
    }
    const version = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "reduced"
      : html.getAttribute("data-perf") === "low" ? "low" : "high";
    const done = () => setShow(false);
    const onEnd = (event: AnimationEvent) => { if (event.target === el) done(); };
    const timer = window.setTimeout(done, splashDurationMs(version));
    el.addEventListener("animationend", onEnd);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("animationend", onEnd);
    };
  }, []);
  if (!show) return null;
  const vars = (v: Record<string, string | number>) => v as CSSProperties;
  return (
    <div id="splash" aria-hidden="true" suppressHydrationWarning>
      <div className="sp-bg">
        {BLOBS.map((b, i) => <span key={i} className="sp-blob" style={vars({ "--x": `${b.x}vmin`, "--y": `${b.y}vmin`, "--i": i, width: `${b.s}vmin`, height: `${b.s}vmin`, borderRadius: b.r })} />)}
        {DROPS.map(([x, y, size], i) => <span key={i} className={`sp-drop${i % 3 === 2 ? " sp-drop-ink" : ""}`} style={vars({ "--x": `${x}vmin`, "--y": `${y}vmin`, "--i": i, width: size, height: size })} />)}
        {DOODLES.map((d, i) => <svg key={i} className="sp-doodle" viewBox="0 0 36 36" style={vars({ left: d.x, top: d.y, "--i": i })}><path d={d.d} /></svg>)}
      </div>
      <div className="sp-center">
        <Logo variant="full" animate="intro" />
        <p className="sp-quote">{SITE_CONFIG.splash.quote}</p>
      </div>
    </div>
  );
}
