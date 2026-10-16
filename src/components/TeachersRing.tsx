import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { TIMING } from "@/config/timing";
import "./teachers-ring.css";

type Slide = (typeof SITE_CONFIG.teachers.slides)[number];
const MIN_SLIDES = 6;
const RESUME_AFTER_MS = 4000;
const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: "spring" as const, stiffness: 120, damping: 20 };

const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

type Geo = { w: number; h: number; persp: number; r: number };
function geoFor(vw: number): Geo {
  let w: number, h: number, persp: number;
  if (vw < 768) { w = Math.min(vw * 0.68, 270); h = 440; persp = 900; }
  else if (vw < 1100) { w = 340; h = 460; persp = 1200; }
  else { w = 380; h = 480; persp = 1500; }
  const r = (w / 2 / Math.tan(Math.PI / 6)) * 1.1;
  return { w, h, persp, r };
}

function Silhouette({ variant }: { variant: number }) {
  const s = variant % 3;
  return (
    <svg className="tr-sil" viewBox="0 0 200 220" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      <circle className="a" cx="100" cy="72" r="36" />
      {s === 0 && <path className="b" d="M66 64c8-26 60-30 70 2" />}
      {s === 1 && <path className="b" d="M64 70c-2-30 18-40 36-40s40 10 36 40" />}
      {s === 2 && <path className="b" d="M70 58c14-22 50-22 62 4M68 60c-6 16-4 30 2 40" />}
      <path className="a" d="M34 220c4-56 30-86 66-86s62 30 66 86" />
      <path className="c" d="M78 138l22 26 22-26" />
    </svg>
  );
}

const PERFS = Array.from({ length: 12 });
function SlideCard({ slide, offset }: { slide: Slide; offset: number }) {
  const t = SITE_CONFIG.teachers;
  return (
    <div className="tr-card">
      <div className="tr-perf top" aria-hidden="true">{PERFS.map((_, k) => <i key={k} />)}</div>
      <div className="tr-photo">
        {/* TODO: replace silhouette with real teacher photo via slide.photo */}
        {slide.photo ? <img src={slide.photo} alt={slide.label} loading="lazy" /> : <Silhouette variant={offset} />}
      </div>
      <div className="tr-text">
        <span className="tr-label">{slide.label}</span>
        <h3 className="tr-trait">{slide.trait}</h3>
        <p className="tr-desc">{slide.description}</p>
        {!slide.photo && <span><span className="tr-tag">{t.profileTag}</span></span>}
      </div>
      <div className="tr-perf bottom" aria-hidden="true">{PERFS.map((_, k) => <i key={k} />)}</div>
    </div>
  );
}

function RingSlide({ i, step, geo, angle, children, onClick, isFront, isRepeat }: {
  i: number; step: number; geo: Geo; angle: MotionValue<number>; children: React.ReactNode;
  onClick: () => void; isFront: boolean; isRepeat: boolean;
}) {
  const rel = (a: number) => wrap(a - i * step); // + => right of front
  const transform = useTransform(angle, (a) => {
    const th = rel(a); const d = Math.abs(th);
    const scale = 1 - 0.1 * Math.min(1, d / 60);
    return `rotateY(${th}deg) translateZ(${geo.r}px) scale(${scale})`;
  });
  const opacity = useTransform(angle, (a) => {
    const d = Math.abs(rel(a));
    if (d <= 60) return 1 - 0.15 * (d / 60);
    if (d >= 100) return 0;
    return 0.85 * (1 - (d - 60) / 40);
  });
  const visibility = useTransform(opacity, (o) => (o <= 0.001 ? "hidden" : "visible"));
  const pointerEvents = useTransform(opacity, (o) => (o <= 0.001 ? "none" : "auto"));
  const blur = useTransform(angle, (a) => Math.min(1, Math.abs(rel(a)) / 60));
  return (
    <motion.div className="tr-slide" style={{ transform, opacity, visibility, pointerEvents }}
      aria-hidden={!isFront || isRepeat} inert={!isFront} onClick={onClick}>
      {children}
      <motion.div className="tr-blur" style={{ opacity: blur }} aria-hidden="true" />
    </motion.div>
  );
}

const SPECKS = Array.from({ length: 36 }, (_, k) => ({
  x: (k * 61.8) % 100, y: (k * 37.3 + 11) % 100, size: k % 4 === 0 ? 2 : 1,
  dur: 3 + ((k * 13) % 40) / 10, delay: ((k * 7) % 30) / 10,
}));

export function TeachersRing() {
  const t = SITE_CONFIG.teachers;
  const real = t.slides;
  const visual = useMemo(() => {
    const out: { slide: Slide; realIndex: number; repeat: boolean }[] = [];
    if (!real.length) return out;
    for (let k = 0; out.length < Math.max(MIN_SLIDES, real.length); k++) out.push({ slide: real[k % real.length]!, realIndex: k % real.length, repeat: k >= real.length });
    return out;
  }, [real]);
  const n = visual.length;
  const step = 360 / n;

  const [reduced, setReduced] = useState(false);
  const [geo, setGeo] = useState<Geo>(() => geoFor(1280));
  const angle = useMotionValue(0);
  const [front, setFront] = useState(0);
  useMotionValueEvent(angle, "change", (a) => {
    const f = ((Math.round(a / step) % n) + n) % n;
    setFront((p) => (p === f ? p : f));
  });

  const sceneRef = useRef<HTMLDivElement>(null);
  const anim = useRef<ReturnType<typeof animate> | null>(null);
  const lastInteraction = useRef(0);
  const [hover, setHover] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [onscreen, setOnscreen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(rm.matches);
    const vis = () => setTabHidden(document.hidden);
    const resize = () => setGeo(geoFor(window.innerWidth));
    sync(); vis(); resize();
    rm.addEventListener("change", sync);
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("resize", resize);
    return () => { rm.removeEventListener("change", sync); document.removeEventListener("visibilitychange", vis); window.removeEventListener("resize", resize); };
  }, []);

  const goTo = useCallback((target: number, spring = false) => {
    anim.current?.stop();
    anim.current = animate(angle, target, spring ? SPRING : { duration: TIMING.teachersStep, ease: EASE });
  }, [angle]);
  // advance (+1): front moves RIGHT, next arrives from LEFT => angle increases
  const move = useCallback((delta: number) => { goTo(Math.round(angle.get() / step) * step + delta * step); }, [angle, goTo, step]);
  const touch = () => { lastInteraction.current = Date.now(); };
  const goToVisual = (i: number) => { const cur = angle.get(); goTo(cur + wrap(i * step - cur)); };

  useEffect(() => {
    const node = sceneRef.current; if (!node) return;
    const io = new IntersectionObserver(([e]) => { const on = !!e?.isIntersecting; setOnscreen(on); if (on) setEntered(true); }, { threshold: 0.2 });
    io.observe(node);
    return () => io.disconnect();
  }, [reduced]);

  const paused = reduced || userPaused || hover || focusWithin || dragging || !onscreen || tabHidden;
  useEffect(() => {
    if (paused) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - lastInteraction.current < RESUME_AFTER_MS) { last = now; return; }
      if (now - last >= TIMING.teachersAdvance * 1000) { last = now; move(1); }
    }, 100);
    return () => window.clearInterval(id);
  }, [paused, move]);

  useEffect(() => {
    const node = sceneRef.current; if (!node || reduced) return;
    let cooldown = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < 30 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      const now = Date.now(); if (now < cooldown) return;
      cooldown = now + 800; touch();
      move(e.deltaX > 0 ? 1 : -1);
    };
    node.addEventListener("wheel", onWheel, { passive: true });
    return () => node.removeEventListener("wheel", onWheel);
  }, [move, reduced]);

  useEffect(() => () => anim.current?.stop(), []);

  const drag = useRef({ active: false, id: -1, x: 0, start: 0, moved: 0, samples: [] as { x: number; t: number }[] });
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { active: true, id: e.pointerId, x: e.clientX, start: angle.get(), moved: 0, samples: [{ x: e.clientX, t: performance.now() }] };
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d.active || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    d.moved = Math.max(d.moved, Math.abs(dx));
    if (d.moved > 6) {
      if (!dragging) { anim.current?.stop(); setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
      angle.set(d.start + (dx / geo.w) * step);
      touch();
    }
    d.samples.push({ x: e.clientX, t: performance.now() });
    if (d.samples.length > 6) d.samples.shift();
  };
  const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d.active || e.pointerId !== d.id) return;
    d.active = false;
    if (d.moved <= 6) return;
    touch();
    const s = d.samples; const a = s[0], b = s[s.length - 1];
    const v = a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
    const extra = Math.max(-2 * step, Math.min(2 * step, ((v * 200) / geo.w) * step));
    const base = Math.round(angle.get() / step) * step;
    const target = Math.max(base - 2 * step, Math.min(base + 2 * step, Math.round((angle.get() + extra) / step) * step));
    goTo(target, true);
    window.setTimeout(() => setDragging(false), 0);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); touch(); move(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); touch(); move(-1); }
  };

  const vars = { "--tr-w": `${geo.w}px`, "--tr-h": `${geo.h}px`, "--tr-persp": `${geo.persp}px` } as Record<string, string>;
  const activeReal = visual[front]?.realIndex ?? 0;

  if (reduced) {
    return (
      <div className="tr-wrap is-reduced" style={vars}>
        <div className="tr-row" role="region" aria-roledescription="carousel" aria-label={t.ringLabel} tabIndex={0}>
          {real.map((s, i) => <div className="tr-row-slide" key={s.id} role="group" aria-label={`${i + 1} / ${real.length}`}><SlideCard slide={s} offset={i} /></div>)}
        </div>
      </div>
    );
  }

  return (
    <motion.div className="tr-wrap" style={vars}
      initial={{ opacity: 0, y: 40 }} animate={entered ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: TIMING.reveal, ease: EASE }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setFocusWithin(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false); }}>
      <div className="tr-specks" aria-hidden="true">
        {SPECKS.map((s, k) => (
          <i key={k} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
        ))}
      </div>
      <div ref={sceneRef} className={`tr-scene ${dragging ? "is-dragging" : ""}`} role="region" aria-roledescription="carousel" aria-label={t.ringLabel} tabIndex={0} onKeyDown={onKey}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <div className="tr-halo" aria-hidden="true" />
        <div className="tr-stage" style={{ transform: `translateZ(${-geo.r}px)` }}>
          {visual.map((v, i) => (
            <RingSlide key={`${v.slide.id}-${i}`} i={i} step={step} geo={geo} angle={angle}
              isFront={i === front} isRepeat={v.repeat}
              onClick={() => {
                if (drag.current.moved > 6) return;
                if (i === front) { setUserPaused((p) => !p); return; }
                touch(); goToVisual(i);
              }}>
              <SlideCard slide={v.slide} offset={i} />
            </RingSlide>
          ))}
        </div>
      </div>
      <p className="tr-paused" aria-live="polite">{userPaused ? t.pausedLabel : ""}</p>
      <div className="tr-dots">
        {real.map((s, i) => (
          <button key={s.id} type="button" className={`tr-dot ${i === activeReal ? "is-active" : ""}`} aria-label={`Show slide ${i + 1}`}
            aria-current={i === activeReal ? "true" : undefined}
            onClick={() => { touch(); const k = visual.findIndex((v) => v.realIndex === i); goToVisual(k >= 0 ? k : i); }}>
            <span />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
