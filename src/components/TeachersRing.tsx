import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import "./teachers-ring.css";

type Slide = (typeof SITE_CONFIG.teachers.slides)[number];
const MIN_SLIDES = 6;
const AUTO_MS = 7000;
const IDLE_AFTER_INTERACTION = 10000;
const SPRING = { type: "spring" as const, stiffness: 120, damping: 20 };

const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

function sizeFor(w: number) {
  if (w < 768) return { w: Math.min(w * 0.84, 320), h: 480 };
  if (w < 1100) return { w: 480, h: 440 };
  return { w: 560, h: 440 };
}

function Silhouette({ variant }: { variant: number }) {
  const s = variant % 3;
  return (
    <svg className="tr-sil" viewBox="0 0 200 220" aria-hidden="true">
      <circle className="a" cx="100" cy="72" r="36" />
      {s === 0 && <path className="b" d="M66 64c8-26 60-30 70 2" />}
      {s === 1 && <path className="b" d="M64 70c-2-30 18-40 36-40s40 10 36 40" />}
      {s === 2 && <path className="b" d="M70 58c14-22 50-22 62 4M68 60c-6 16-4 30 2 40" />}
      <path className="a" d="M34 210c4-56 30-86 66-86s62 30 66 86" />
      <path className="c" d="M78 128l22 26 22-26" />
      <path className="c" d="M20 210h160" />
    </svg>
  );
}

function SlideCard({ slide, offset }: { slide: Slide; offset: number }) {
  const t = SITE_CONFIG.teachers;
  if (slide.layout === "single") {
    const p = slide.people[0]!;
    return (
      <div className="tr-card tr-single">
        <div className="tr-art"><Silhouette variant={offset} /></div>
        <div className="tr-text">
          <span className="tr-label">{p.label}</span>
          <h3 className="tr-trait">{p.trait}</h3>
          <p className="tr-desc">{p.description}</p>
          <span><span className="tr-tag">{t.profileTag}</span></span>
        </div>
      </div>
    );
  }
  return (
    <div className="tr-card tr-trio">
      {slide.people.map((p, i) => (
        <div className="tr-person" key={p.label}>
          <div className="tr-art"><Silhouette variant={offset + i} /></div>
          <div>
            <span className="tr-label">{p.label}</span>
            <h3 className="tr-trait">{p.trait}</h3>
            <p className="tr-desc">{p.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RingSlide({ i, step, radius, rotation, children, onClick, isFront, isRepeat }: {
  i: number; step: number; radius: number; rotation: MotionValue<number>; children: React.ReactNode;
  onClick: () => void; isFront: boolean; isRepeat: boolean;
}) {
  const opacity = useTransform(rotation, (r) => {
    const d = Math.abs(wrap(r - i * step));
    if (d <= 60) return 1 - (0.5 * d) / 60;
    if (d >= 120) return 0;
    return (0.5 * (120 - d)) / 60;
  });
  return (
    <motion.div
      className="tr-slide"
      style={{ transform: `rotateY(${-i * step}deg) translateZ(${radius}px)`, opacity }}
      aria-hidden={!isFront || isRepeat}
      inert={!isFront}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

export function TeachersRing() {
  const t = SITE_CONFIG.teachers;
  const real = t.slides;
  const visual = useMemo(() => {
    const out: { slide: Slide; realIndex: number; repeat: boolean }[] = [];
    if (!real.length) return out;
    let k = 0;
    while (out.length < Math.max(MIN_SLIDES, real.length)) { out.push({ slide: real[k % real.length]!, realIndex: k % real.length, repeat: k >= real.length }); k++; }
    return out;
  }, [real]);
  const n = visual.length;
  const step = 360 / n;

  const [reduced, setReduced] = useState(false);
  const [size, setSize] = useState({ w: 560, h: 440 });
  const radius = size.w / 2 / Math.tan((step / 2) * (Math.PI / 180));

  const rotation = useMotionValue(0);
  const stageTransform = useTransform(rotation, (r) => `translateZ(${-radius}px) rotateY(${r}deg)`);
  const [front, setFront] = useState(0);
  useMotionValueEvent(rotation, "change", (r) => {
    const f = ((Math.round(r / step) % n) + n) % n;
    setFront((p) => (p === f ? p : f));
  });

  const sceneRef = useRef<HTMLDivElement>(null);
  const anim = useRef<ReturnType<typeof animate> | null>(null);
  const lastInteraction = useRef(0);
  const [hover, setHover] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [onscreen, setOnscreen] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(rm.matches);
    const vis = () => setTabHidden(document.hidden);
    const resize = () => setSize(sizeFor(window.innerWidth));
    sync(); vis(); resize();
    rm.addEventListener("change", sync);
    document.addEventListener("visibilitychange", vis);
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
    return () => { rm.removeEventListener("change", sync); document.removeEventListener("visibilitychange", vis); ro.disconnect(); };
  }, []);

  const snapTo = useCallback((target: number) => {
    anim.current?.stop();
    anim.current = animate(rotation, target, SPRING);
  }, [rotation]);

  const nearest = () => Math.round(rotation.get() / step) * step;
  const move = useCallback((delta: number) => { snapTo(Math.round(rotation.get() / step) * step + delta * step); }, [rotation, snapTo, step]);
  const touch = () => { lastInteraction.current = Date.now(); };
  const goToVisual = (i: number) => {
    const base = nearest();
    const cur = ((Math.round(base / step) % n) + n) % n;
    let d = i - cur;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    snapTo(base + d * step);
  };

  // Offscreen pause
  useEffect(() => {
    const node = sceneRef.current; if (!node) return;
    const io = new IntersectionObserver(([e]) => setOnscreen(!!e?.isIntersecting), { threshold: 0.2 });
    io.observe(node);
    return () => io.disconnect();
  }, [reduced]);

  // Auto-advance
  const paused = reduced || hover || focusWithin || dragging || !onscreen || tabHidden;
  useEffect(() => {
    if (paused) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - lastInteraction.current < IDLE_AFTER_INTERACTION) { last = now; return; }
      if (now - last >= AUTO_MS) { last = now; move(1); }
    }, 250);
    return () => window.clearInterval(id);
  }, [paused, move]);

  // Trackpad horizontal wheel
  useEffect(() => {
    const node = sceneRef.current; if (!node || reduced) return;
    let cooldown = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < 30 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      const now = Date.now(); if (now < cooldown) return;
      cooldown = now + 650; touch();
      move(e.deltaX > 0 ? 1 : -1);
    };
    node.addEventListener("wheel", onWheel, { passive: true });
    return () => node.removeEventListener("wheel", onWheel);
  }, [move, reduced]);

  useEffect(() => () => anim.current?.stop(), []);

  // Drag
  const drag = useRef({ active: false, id: -1, x: 0, start: 0, moved: 0, samples: [] as { x: number; t: number }[] });
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    anim.current?.stop();
    drag.current = { active: true, id: e.pointerId, x: e.clientX, start: rotation.get(), moved: 0, samples: [{ x: e.clientX, t: performance.now() }] };
    touch();
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d.active || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    d.moved = Math.max(d.moved, Math.abs(dx));
    if (d.moved > 6 && !dragging) { setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    if (d.moved > 6) rotation.set(d.start + (dx / size.w) * step);
    d.samples.push({ x: e.clientX, t: performance.now() });
    if (d.samples.length > 6) d.samples.shift();
  };
  const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d.active || e.pointerId !== d.id) return;
    d.active = false; touch();
    if (d.moved <= 6) { setDragging(false); return; }
    const s = d.samples; const a = s[0], b = s[s.length - 1];
    const v = a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0; // px/ms
    const extraDeg = Math.max(-2 * step, Math.min(2 * step, ((v * 200) / size.w) * step));
    snapTo(Math.round((rotation.get() + extraDeg) / step) * step);
    window.setTimeout(() => setDragging(false), 0);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); touch(); move(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); touch(); move(-1); }
  };

  const vars = { "--tr-w": `${size.w}px`, "--tr-h": `${size.h}px` } as React.CSSProperties;
  const activeReal = visual[front]?.realIndex ?? 0;

  if (reduced) {
    return (
      <div className="tr-wrap" style={vars}>
        <div className="tr-row" role="region" aria-roledescription="carousel" aria-label={t.ringLabel} tabIndex={0}>
          {real.map((s, i) => <div className="tr-slide" key={s.id} role="group" aria-label={`${i + 1} / ${real.length}`}><SlideCard slide={s} offset={i} /></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="tr-wrap" style={vars}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setFocusWithin(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false); }}>
      <div ref={sceneRef} className="tr-scene" role="region" aria-roledescription="carousel" aria-label={t.ringLabel} tabIndex={0} onKeyDown={onKey}>
        <div className="tr-floor" aria-hidden="true" />
        <motion.div className={`tr-stage ${dragging ? "is-dragging" : ""}`} style={{ transform: stageTransform }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          {visual.map((v, i) => (
            <RingSlide key={`${v.slide.id}-${i}`} i={i} step={step} radius={radius} rotation={rotation}
              isFront={i === front} isRepeat={v.repeat}
              onClick={() => { if (drag.current.moved > 6 || i === front) return; touch(); goToVisual(i); }}>
              <SlideCard slide={v.slide} offset={i} />
            </RingSlide>
          ))}
        </motion.div>
      </div>
      <div className="tr-dots">
        {real.map((s, i) => (
          <button key={s.id} type="button" className={`tr-dot ${i === activeReal ? "is-active" : ""}`} aria-label={`Show slide ${i + 1}`}
            aria-current={i === activeReal ? "true" : undefined}
            onClick={() => { touch(); const targets = visual.map((v, k) => (v.realIndex === i ? k : -1)).filter((k) => k >= 0); goToVisual(targets[0] ?? i); }}>
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}
