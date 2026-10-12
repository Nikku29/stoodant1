import { useEffect, useRef, useState } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";

// Wave timing (ms): dwell on each step, travel between steps, pause before restart (~3s per step).
const DWELL = 1200;
const TRAVEL = 1800;
const PAUSE = 1000;
const DRAW = 1400;
const PATH_D = "M40 230C190 40 305 40 440 200s250 145 370-15 230-125 350-55";
const VB_W = 1200;
const VB_H = 340;

type Pt = { x: number; y: number };

export function ProcessSequence() {
  const root = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [drawn, setDrawn] = useState(false);
  const [active, setActive] = useState(-1);
  const [nodes, setNodes] = useState<Pt[]>([]);
  const [reduced, setReduced] = useState(false);
  const visibleRef = useRef(false);
  const steps = SITE_CONFIG.process.steps;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Measure node positions (px, relative to the map) for the current layout.
  const nodesRef = useRef<Pt[]>([]);
  const fracRef = useRef<number[]>([]);
  useEffect(() => {
    const measure = () => {
      const map = root.current;
      const path = pathRef.current;
      if (!map) return;
      const vertical = window.matchMedia("(max-width: 1023px)").matches;
      const rect = map.getBoundingClientRect();
      let pts: Pt[];
      if (vertical || !path) {
        pts = cardRefs.current.map((card) => {
          const r = card?.getBoundingClientRect();
          return { x: 24, y: r ? r.top - rect.top + 48 : 0 };
        });
      } else {
        const len = path.getTotalLength();
        const fr = steps.map((_, i) => i / (steps.length - 1));
        fracRef.current = fr;
        pts = fr.map((f) => {
          const p = path.getPointAtLength(f * len);
          return { x: (p.x / VB_W) * rect.width, y: (p.y / VB_H) * VB_H };
        });
      }
      (map.dataset as DOMStringMap)["vertical"] = vertical ? "1" : "0";
      nodesRef.current = pts;
      setNodes(pts);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (root.current) ro.observe(root.current);
    return () => ro.disconnect();
  }, [steps]);

  // Draw once on entry; track visibility to pause the loop offscreen.
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = Boolean(entry?.isIntersecting);
      if (entry?.isIntersecting) setDrawn(true);
    }, { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Wave loop.
  useEffect(() => {
    if (!drawn || reduced) return;
    const n = steps.length;
    const loop = n * DWELL + (n - 1) * TRAVEL + PAUSE;
    let elapsed = 0;
    let last = performance.now();
    let started = false;
    let raf = 0;
    let shown = -1;
    const startAt = performance.now() + DRAW;

    const pointAt = (from: number, to: number, t: number): Pt => {
      const path = pathRef.current;
      const vertical = root.current?.dataset["vertical"] === "1";
      const pts = nodesRef.current;
      if (!vertical && path && root.current) {
        const len = path.getTotalLength();
        const f0 = from / (n - 1), f1 = to / (n - 1);
        const p = path.getPointAtLength((f0 + (f1 - f0) * t) * len);
        const w = root.current.getBoundingClientRect().width;
        return { x: (p.x / VB_W) * w, y: p.y };
      }
      const a = pts[from] ?? { x: 24, y: 0 }, b = pts[to] ?? a;
      return { x: a.x, y: a.y + (b.y - a.y) * t };
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = now - last;
      last = now;
      if (now < startAt || !visibleRef.current) return;
      if (!started) { started = true; return; }
      elapsed = (elapsed + dt) % loop;
      let t = elapsed;
      let lit = -1;
      let pos: Pt | null = null;
      let alpha = 1;
      for (let i = 0; i < n; i++) {
        if (t < DWELL) { lit = i; pos = pointAt(i, i, 0); if (i === n - 1) alpha = 1 - Math.max(0, (t - DWELL * 0.5) / (DWELL * 0.5)); break; }
        t -= DWELL;
        if (i < n - 1) {
          if (t < TRAVEL) { const e = t / TRAVEL; pos = pointAt(i, i + 1, e * e * (3 - 2 * e)); break; }
          t -= TRAVEL;
        } else { alpha = 0; pos = pointAt(0, 0, 0); }
      }
      if (lit !== shown) { shown = lit; setActive(lit); }
      const dot = dotRef.current;
      if (dot && pos) {
        dot.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        dot.style.opacity = String(alpha);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [drawn, reduced, steps.length]);

  const isDrawn = drawn || reduced;

  return (
    <div className={`process-sequence${isDrawn ? " is-drawn" : ""}${reduced ? " is-reduced" : ""}`} aria-label="How Stoodant works" role="region">
      <div className="process-map" ref={root}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-hidden="true" className="process-curve">
          <path className="process-path-base" pathLength="1" d={PATH_D} />
          <path ref={pathRef} className="process-path-progress" pathLength="1" d={PATH_D} />
        </svg>
        <span className="process-line" aria-hidden="true" />
        {nodes.map((p, i) => (
          <span key={i} className="process-node" aria-hidden="true" style={{ transform: `translate(${p.x}px, ${p.y}px)`, transitionDelay: `${(i / (steps.length - 1)) * DRAW}ms` }}><i /></span>
        ))}
        {!reduced && <span ref={dotRef} className="process-wave-dot" aria-hidden="true" />}
        <ol className="process-steps">
          {steps.map((step, index) => (
            <li key={step.number} ref={(el) => { cardRefs.current[index] = el; }} className={`process-card${index === active || reduced ? " is-lit" : ""}`}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
