import { animate, motion, useMotionValue, useMotionValueEvent, useSpring, useTransform, useVelocity, type MotionValue } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import "./teachers-ring.css";

type Slide = (typeof SITE_CONFIG.teachers.slides)[number];
const MIN_SLIDES = 6;
const AUTO_MS = 6000;
const IDLE_AFTER_INTERACTION = 10000;
const EASE = [0.22, 1, 0.36, 1] as const;
const STEP_ANIM = { duration: 1.4, ease: EASE };
const SPRING = { type: "spring" as const, stiffness: 120, damping: 20 };
const SCALE_90 = 0.55 + 0.45 * 0.5;

const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const rad = (d: number) => (d * Math.PI) / 180;

type Geo = { w: number; h: number; rz: number; rx: number; disc: number; persp: number; touch: boolean };
function geoFor(vw: number): Geo {
  const touch = typeof window !== "undefined" && !window.matchMedia("(pointer: fine)").matches;
  let w: number, h: number, rz: number, disc: number, persp: number;
  if (vw < 768) { w = Math.min(vw * 0.86, 330); h = 480; rz = 240; disc = 180; persp = 800; }
  else if (vw < 1100) { w = 440; h = 440; rz = 300; disc = 240; persp = 1100; }
  else { w = 520; h = 440; rz = 380; disc = 300; persp = 1400; }
  // Keep a slide at 90deg fully inside the viewport (16px margin).
  const fit = vw / 2 - (w * SCALE_90) / 2 - 16;
  const rx = Math.max(0, Math.min(Math.max(0.22 * vw, fit), fit));
  return { w, h, rz, rx, disc, persp, touch };
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

function OrbitSlide({ i, step, geo, eff, skew, children, onClick, isFront, isRepeat, entered }: {
  i: number; step: number; geo: Geo; eff: MotionValue<number>; skew: MotionValue<number>; children: React.ReactNode;
  onClick: () => void; isFront: boolean; isRepeat: boolean; entered: boolean;
}) {
  const transform = useTransform([eff, skew], ([r, sk]: number[]) => {
    const a = rad(i * step - r!);
    const s = Math.sin(a), c = Math.cos(a);
    const scale = 0.55 + 0.45 * ((c + 1) / 2);
    return `translate3d(${geo.rx * s}px, ${-c * 40}px, ${geo.rz * c}px) rotateY(${-s * 28}deg) skewX(${sk}deg) scale(${scale})`;
  });
  const dim = useTransform(eff, (r) => {
    const d = Math.abs(wrap(i * step - r));
    return d <= 60 ? (0.45 * d) / 60 : 0.45 + (0.2 * (d - 60)) / 120;
  });
  const rim = useTransform(eff, (r) => Math.pow(Math.max(0, Math.cos(rad(i * step - r))), 6));
  return (
    <motion.div className="tr-slide" style={{ transform }} aria-hidden={!isFront || isRepeat} inert={!isFront} onClick={onClick}>
      <motion.div className="tr-slide-in" initial={false}
        animate={entered ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.8, ease: EASE, delay: entered ? 0.8 + i * 0.08 : 0 }}>
        {children}
        <motion.div className="tr-dim" style={{ opacity: dim }} aria-hidden="true" />
        <motion.div className="tr-rim" style={{ opacity: rim }} aria-hidden="true" />
      </motion.div>
    </motion.div>
  );
}

const RAYS = Array.from({ length: 48 }, (_, k) => ({ a: (k / 48) * 360, len: 10 + ((k * 37) % 23) }));

function Eclipse({ geo, coronaOpacity, still }: { geo: Geo; coronaOpacity?: MotionValue<number>; still?: boolean }) {
  const k = still ? 1 : (geo.persp + geo.rz) / geo.persp;
  geo = { ...geo, disc: geo.disc * k };
  const r = geo.disc / 2;
  const box = geo.disc + 120;
  return (
    <>
      <motion.div className={`tr-corona ${still ? "is-still" : ""}`} style={{ opacity: coronaOpacity ?? 0.8, width: box, height: box }} aria-hidden="true">
        <div className="tr-halo" style={{ width: geo.disc * 2, height: geo.disc * 2 }} />
        <svg className="tr-rays" viewBox={`0 0 ${box} ${box}`}>
          {RAYS.map((ray, k) => {
            const t = rad(ray.a), c = box / 2;
            return <line key={k} x1={c + Math.cos(t) * (r + 4)} y1={c + Math.sin(t) * (r + 4)} x2={c + Math.cos(t) * (r + 4 + ray.len)} y2={c + Math.sin(t) * (r + 4 + ray.len)} />;
          })}
        </svg>
        {!still && <div className="tr-diamond-track" style={{ width: geo.disc, height: geo.disc }}><i /></div>}
      </motion.div>
      <div className="tr-disc" style={{ width: geo.disc, height: geo.disc }} aria-hidden="true" />
    </>
  );
}

const SPECKS = Array.from({ length: 36 }, (_, k) => ({
  x: (k * 61.8) % 100, y: (k * 37.3 + 11) % 100, depth: k % 3, size: k % 4 === 0 ? 2 : 1,
  dur: 3 + ((k * 13) % 40) / 10, delay: ((k * 7) % 30) / 10,
}));

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
  const [geo, setGeo] = useState<Geo>({ w: 520, h: 440, rz: 380, rx: 300, disc: 300, persp: 1400, touch: false });

  const angle = useMotionValue(0);
  const breath = useMotionValue(0);
  const pulse = useMotionValue(0.7);
  const eff = useTransform([angle, breath], ([a, b]: number[]) => a! + b!);
  const vel = useVelocity(angle);
  const skew = useTransform(vel, (v) => Math.max(-8, Math.min(8, -v / 40)));
  const coronaOpacity = useTransform([eff, vel, pulse], ([r, v, p]: number[]) => {
    let behind = 0;
    for (let i = 0; i < n; i++) { const d = Math.abs(Math.abs(wrap(i * step - r!)) - 180); if (d < 25) behind = Math.max(behind, 1 - d / 25); }
    const fast = Math.min(1, Math.abs(v!) / 200);
    return Math.min(1, Math.max(p!, p! + (1 - p!) * Math.max(behind, fast)));
  });
  const mouseX = useMotionValue(0);
  const tilt = useSpring(mouseX, { stiffness: 60, damping: 18 });
  const stageTransform = useTransform(tilt, (m) => `translateZ(${-geo.rz}px) rotateX(-6deg) rotateY(${m * 6}deg)`);
  const eclipseShift = useTransform(tilt, (m) => `translate3d(calc(-50% + ${-m * 12}px), -50%, 0)`);

  const [front, setFront] = useState(0);
  useMotionValueEvent(angle, "change", (r) => {
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
  const [entered, setEntered] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(rm.matches);
    const vis = () => setTabHidden(document.hidden);
    const resize = () => setGeo(geoFor(window.innerWidth));
    sync(); vis(); resize();
    rm.addEventListener("change", sync);
    document.addEventListener("visibilitychange", vis);
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
    return () => { rm.removeEventListener("change", sync); document.removeEventListener("visibilitychange", vis); ro.disconnect(); };
  }, []);

  // Breathing + corona pulse
  useEffect(() => {
    if (reduced) return;
    const a = animate(breath, [0, 1.5, 0, -1.5, 0], { duration: 7, repeat: Infinity, ease: "easeInOut" });
    const b = animate(pulse, [0.55, 0.9, 0.55], { duration: 6, repeat: Infinity, ease: "easeInOut" });
    return () => { a.stop(); b.stop(); };
  }, [reduced, breath, pulse]);

  const goTo = useCallback((target: number, spring = false) => {
    anim.current?.stop();
    anim.current = animate(angle, target, spring ? SPRING : STEP_ANIM);
  }, [angle]);

  // advance (+1): front slide travels right => angle decreases
  const move = useCallback((delta: number) => { goTo(Math.round(angle.get() / step) * step - delta * step); }, [angle, goTo, step]);
  const touch = () => { lastInteraction.current = Date.now(); };
  const goToVisual = (i: number) => { const cur = angle.get(); goTo(Math.round((cur + wrap(i * step - cur)) / step) * step); };

  // Offscreen pause + one-time entrance
  useEffect(() => {
    const node = sceneRef.current; if (!node) return;
    const io = new IntersectionObserver(([e]) => { const on = !!e?.isIntersecting; setOnscreen(on); if (on) setEntered(true); }, { threshold: 0.2 });
    io.observe(node);
    return () => io.disconnect();
  }, [reduced]);

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
      cooldown = now + 900; touch();
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
    drag.current = { active: true, id: e.pointerId, x: e.clientX, start: angle.get(), moved: 0, samples: [{ x: e.clientX, t: performance.now() }] };
    touch();
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && !geo.touch && sceneRef.current) {
      const r = sceneRef.current.getBoundingClientRect();
      mouseX.set(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)));
    }
    const d = drag.current; if (!d.active || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    d.moved = Math.max(d.moved, Math.abs(dx));
    if (d.moved > 6 && !dragging) { anim.current?.stop(); setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    if (d.moved > 6) angle.set(d.start - (dx / geo.w) * step);
    d.samples.push({ x: e.clientX, t: performance.now() });
    if (d.samples.length > 6) d.samples.shift();
  };
  const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d.active || e.pointerId !== d.id) return;
    d.active = false; touch();
    if (d.moved <= 6) { setDragging(false); return; }
    const s = d.samples; const a = s[0], b = s[s.length - 1];
    const v = a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
    const extra = Math.max(-2 * step, Math.min(2 * step, -((v * 200) / geo.w) * step));
    goTo(Math.round((angle.get() + extra) / step) * step, true);
    window.setTimeout(() => setDragging(false), 0);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); touch(); move(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); touch(); move(-1); }
  };

  const vars = { "--tr-w": `${geo.w}px`, "--tr-h": `${geo.h}px`, "--tr-persp": `${geo.persp}px` } as React.CSSProperties;
  const activeReal = visual[front]?.realIndex ?? 0;

  if (reduced) {
    return (
      <div className="tr-wrap is-reduced" style={vars}>
        <div className="tr-static-eclipse"><div className="tr-eclipse" style={{ transform: "translate(-50%,-50%)" }}><Eclipse geo={geo} still /></div></div>
        <div className="tr-row" role="region" aria-roledescription="carousel" aria-label={t.ringLabel} tabIndex={0}>
          {real.map((s, i) => <div className="tr-row-slide" key={s.id} role="group" aria-label={`${i + 1} / ${real.length}`}><SlideCard slide={s} offset={i} /></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="tr-wrap" style={vars}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); mouseX.set(0); }}
      onFocus={() => setFocusWithin(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false); }}>
      <div className="tr-specks" aria-hidden="true">
        {SPECKS.map((s, k) => (
          <i key={k} className={`d${s.depth}`} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
        ))}
      </div>
      <div ref={sceneRef} className="tr-scene" role="region" aria-roledescription="carousel" aria-label={t.ringLabel} tabIndex={0} onKeyDown={onKey}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <motion.div className={`tr-stage ${dragging ? "is-dragging" : ""}`} style={{ transform: stageTransform }}>
          <motion.div className="tr-eclipse" style={{ transform: eclipseShift }}
            initial={false} animate={{ opacity: entered ? 1 : 0 }} transition={{ duration: 0.8, ease: EASE }}>
            <Eclipse geo={geo} coronaOpacity={coronaOpacity} />
          </motion.div>
          {visual.map((v, i) => (
            <OrbitSlide key={`${v.slide.id}-${i}`} i={i} step={step} geo={geo} eff={eff} skew={skew} entered={entered}
              isFront={i === front} isRepeat={v.repeat}
              onClick={() => { if (drag.current.moved > 6 || i === front) return; touch(); goToVisual(i); }}>
              <SlideCard slide={v.slide} offset={i} />
            </OrbitSlide>
          ))}
        </motion.div>
      </div>
      <div className="tr-dots">
        {real.map((s, i) => (
          <button key={s.id} type="button" className={`tr-dot ${i === activeReal ? "is-active" : ""}`} aria-label={`Show slide ${i + 1}`}
            aria-current={i === activeReal ? "true" : undefined}
            onClick={() => { touch(); const k = visual.findIndex((v) => v.realIndex === i); goToVisual(k >= 0 ? k : i); }}>
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}
