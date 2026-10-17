import { useEffect, useRef } from "react";
import { AntUse } from "./Ant";

const TRAIL_W = 320;
const ANT_X = TRAIL_W / 2 - 34; // the ant rests just left of centre, head near the middle

/**
 * Section divider: a dotted trail. When it first scrolls in from below, the ant walks across once
 * (transform only) and stops near the centre. Scrolling up never replays. Low tier / reduced motion:
 * the ant simply sits on the trail.
 */
export function AntTrail({ inverse = false }: { inverse?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const animated = document.documentElement.getAttribute("data-perf") === "high" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Only stage the walk if the trail is still below the viewport; otherwise the ant just sits.
    if (!animated || el.getBoundingClientRect().top < window.innerHeight) return;
    el.classList.add("is-waiting");
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      el.classList.replace("is-waiting", "is-walking");
    });
    io.observe(el);
    const done = (event: AnimationEvent) => {
      if (event.animationName !== "ant-cross") return;
      el.classList.remove("is-walking");
    };
    el.addEventListener("animationend", done);
    return () => {
      io.disconnect();
      el.removeEventListener("animationend", done);
    };
  }, []);
  return (
    <div ref={ref} className={`ant-trail${inverse ? " inverse" : ""}`} aria-hidden="true">
      <svg viewBox={`0 0 ${TRAIL_W} 48`}>
        <line className="ant-trail-dots" x1="1" y1="41.5" x2={TRAIL_W - 1} y2="41.5" />
        <g className="ant-trail-walker">
          <AntUse x={ANT_X} y={0} className="ant-trail-ant" />
        </g>
      </svg>
    </div>
  );
}
