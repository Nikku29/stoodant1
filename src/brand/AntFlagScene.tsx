import { useEffect, useRef, useState } from "react";
import { TIMING } from "@/config/timing";
import { SITE_CONFIG } from "@/config/siteConfig";
import { AntUse } from "./Ant";
import { FLAG, SLOPE, SLOPE_DEG, START, sceneAt } from "./antScene";

const at = sceneAt;

/**
 * Final CTA graphic: the ant walks a dotted path toward a small flag (high tier loops gently and
 * pauses offscreen; low tier is static). On form success the ant reaches the flag, the flag waves
 * and two spark lines pop above the ant's eyes.
 */
export function AntFlagScene({ success }: { success: boolean }) {
  const scene = useRef<SVGSVGElement>(null);
  const walker = useRef<SVGGElement>(null);
  const [arrived, setArrived] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(document.documentElement.getAttribute("data-perf") === "high" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const el = scene.current;
    if (!el || !animated) return;
    const io = new IntersectionObserver(([entry]) => el.classList.toggle("is-paused", !entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [animated]);

  useEffect(() => {
    const g = walker.current;
    if (!success || !g || arrived) return;
    if (!animated) { setArrived(true); return; }
    // Continue from wherever the loop is, straight to the flag.
    const from = getComputedStyle(g).transform;
    g.style.animation = "none";
    const anim = g.animate([{ transform: from === "none" ? at(0) : from, opacity: 1 }, { transform: at(1), opacity: 1 }], {
      duration: TIMING.ant.ctaArrive * 1000,
      easing: "cubic-bezier(.3,.1,.4,1)",
      fill: "forwards",
    });
    anim.finished.then(() => setArrived(true), () => undefined);
    return () => anim.cancel();
  }, [success, animated, arrived]);

  const walking = animated && !arrived;
  const pose = arrived ? "celebrate" : walking ? "walk" : "static";
  return (
    <figure className="cta-scene">
      <svg ref={scene} viewBox="0 0 400 180" className={`cta-scene-svg${animated ? " is-animated" : ""}${arrived ? " is-arrived" : ""}`} role="img" aria-label={arrived ? "The ant has reached the flag" : "An ant walking along a dotted path toward a flag"}>
        <line className="cta-scene-path" x1={START.x - 24} y1={START.y - 24 * SLOPE} x2={FLAG.x} y2={FLAG.y} />
        <g className="cta-flag" transform={`translate(${FLAG.x + 14} ${FLAG.y})`}>
          <path className="cta-flag-pole" d="M0 0V-58" />
          <path className="cta-flag-cloth" d="M1 -57h26l-7 9 7 9H1Z" />
        </g>
        <g ref={walker} className="cta-walker" style={arrived ? { transform: at(1) } : !animated ? { transform: at(0.55) } : undefined}>
          <g transform={`translate(${START.x} ${START.y}) rotate(${SLOPE_DEG.toFixed(1)})`}>
            <AntUse x={-50} y={-41} pose={pose} />
            {arrived && (
              <g className="cta-sparks">
                <path d="M10 -34l4 -6" />
                <path d="M14 -28l7 -2" />
              </g>
            )}
          </g>
        </g>
      </svg>
      <figcaption className="cta-scene-caption">{SITE_CONFIG.brand.tagline}</figcaption>
    </figure>
  );
}
