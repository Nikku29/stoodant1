import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { splashDurationMs } from "./splashTiming";

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
  return (
    <div id="splash" aria-hidden="true" suppressHydrationWarning>
      <Logo variant="full" animate="intro" />
    </div>
  );
}
