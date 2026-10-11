import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

/** Props every story slide graphic receives. Play once from frame 0 while active, call onDone at the last frame. */
export type StorySlideProps = { active: boolean; onDone: () => void; reducedMotion: boolean; paused: boolean };
export type AutoSlide = { title: string; caption?: ReactNode; graphic?: ReactNode; Graphic?: ComponentType<StorySlideProps> };

const MIN_SLIDE = 5000;
const WATCHDOG = 12000;
const FADE = 600;

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/**
 * Plays the slide's CSS animations exactly once (infinite loops are clamped to one iteration),
 * pauses them with the story, and reports completion.
 */
function CssOnce({ active, onDone, paused, scope, children }: StorySlideProps & { scope: React.RefObject<HTMLElement | null>; children: ReactNode }) {
  const anims = useRef<Animation[]>([]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      const node = scope.current;
      const all = node && typeof node.getAnimations === "function" ? node.getAnimations({ subtree: true }) : [];
      const list = all.filter((a) => typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation);
      anims.current = list;
      list.forEach((a) => { try { a.effect?.updateTiming({ iterations: 1, fill: "forwards" }); } catch { /* ignore */ } });
      if (!list.length) { onDone(); return; }
      Promise.all(list.map((a) => a.finished)).then(() => { if (!cancelled) onDone(); }, () => { /* cancelled: not a finish */ });
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); anims.current = []; };
  }, [active, onDone, scope]);
  useEffect(() => {
    anims.current.forEach((a) => {
      if (paused && a.playState === "running") a.pause();
      else if (!paused && a.playState === "paused") a.play();
    });
  }, [paused]);
  return <>{children}</>;
}

export function AutoStory({ slides, label, className = "" }: { slides: AutoSlide[]; label: string; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const count = slides.length;

  const paused = !visible || hidden || (desktop && (hover || focus));
  const clock = useRef({ elapsed: 0, doneAt: -1, hold: 1500 });

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dk = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => { setReduced(rm.matches); setDesktop(dk.matches); };
    const vis = () => setHidden(document.hidden);
    sync(); vis();
    rm.addEventListener("change", sync); dk.addEventListener("change", sync);
    document.addEventListener("visibilitychange", vis);
    return () => { rm.removeEventListener("change", sync); dk.removeEventListener("change", sync); document.removeEventListener("visibilitychange", vis); };
  }, []);

  const restart = useCallback(() => {
    clock.current = { elapsed: 0, doneAt: -1, hold: 1500 };
    setIndex(0); setPrev(null); setCycle((c) => c + 1);
  }, []);

  useEffect(() => {
    const node = root.current; if (!node) return;
    let wasGone = true;
    const io = new IntersectionObserver(([e]) => {
      if (!e) return;
      if (e.intersectionRatio >= 0.4) {
        if (wasGone) restart();
        wasGone = false; setVisible(true);
      } else {
        setVisible(false);
        if (!e.isIntersecting) wasGone = true;
      }
    }, { threshold: [0, 0.4] });
    io.observe(node);
    return () => io.disconnect();
  }, [restart]);

  const advance = useCallback(() => {
    clock.current = { elapsed: 0, doneAt: -1, hold: 1500 };
    setIndex((cur) => { setPrev(cur); return (cur + 1) % count; });
    setCycle((c) => c + 1);
  }, [count]);

  const live = useRef({ index: 0, cycle: 0 });
  live.current = { index, cycle };
  const onDone = useCallback(() => {
    if (live.current.index !== index || live.current.cycle !== cycle) return;
    const c = clock.current;
    if (c.doneAt >= 0) return;
    const el = slideRefs.current[index];
    const cap = el?.querySelector(".ass-caption")?.textContent ?? "";
    c.hold = Math.max(1500, 300 * words(cap));
    c.doneAt = c.elapsed;
  }, [index, cycle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pausable story clock: only ticks while running.
  useEffect(() => {
    if (reduced || paused) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const c = clock.current;
      c.elapsed += Math.max(0, now - last); last = now;
      const ready = c.doneAt >= 0 && c.elapsed >= Math.max(MIN_SLIDE - FADE, c.doneAt + c.hold);
      if (ready || c.elapsed >= WATCHDOG - FADE) { advance(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, paused, advance, index, cycle]);

  if (reduced) {
    return (
      <div className={`ass is-reduced ${className}`} role="region" aria-label={label}>
        <div className="ass-stack">
          {slides.map((s, i) => (
            <article key={s.title} className="ass-card ass-stack-card" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="ass-slide is-active">
                <span className="ass-num">0{i + 1}</span>
                <h3 className="ass-title">{s.title}</h3>
                <div className="ass-graphic">{s.Graphic ? <s.Graphic active={false} onDone={() => {}} reducedMotion paused /> : s.graphic}</div>
                {s.caption && <div className="ass-caption">{s.caption}</div>}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className={`ass ${paused ? "is-paused" : ""} ${className}`} role="region" aria-label={label}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocus(false); }}>
      <div className="ass-card">
        <p className="sr-only" aria-live="polite">{slides[index]?.title ?? ""}</p>
        {slides.map((s, i) => {
          const isActive = i === index && visible !== undefined;
          const state = i === index ? "is-active" : i === prev ? "is-leaving" : "is-waiting";
          const ref = { current: slideRefs.current[i] ?? null } as React.RefObject<HTMLElement | null>;
          const props: StorySlideProps = { active: isActive && i === index, onDone: i === index ? onDone : noop, reducedMotion: false, paused };
          return (
            <article key={s.title} ref={(n) => { slideRefs.current[i] = n; ref.current = n; }} className={`ass-slide ${state}`} aria-hidden={i !== index}>
              <span className="ass-num">0{i + 1}</span>
              <h3 className="ass-title">{s.title}</h3>
              <SlideBody key={i === index ? `a${cycle}` : "idle"} slide={s} props={props} scopeIndex={i} slideRefs={slideRefs} />
            </article>
          );
        })}
      </div>
      <div className="ass-dots" aria-hidden="true">
        {slides.map((s, i) => <span key={s.title} className={`ass-dot ${i === index ? "is-active" : ""}`} />)}
      </div>
    </div>
  );
}

const noop = () => {};

function SlideBody({ slide, props, scopeIndex, slideRefs }: { slide: AutoSlide; props: StorySlideProps; scopeIndex: number; slideRefs: React.RefObject<(HTMLElement | null)[]> }) {
  const scope = useRef<HTMLElement | null>(null);
  useEffect(() => { scope.current = slideRefs.current[scopeIndex] ?? null; });
  if (slide.Graphic) {
    const G = slide.Graphic;
    return <>
      <div className="ass-graphic"><G {...props} /></div>
      {slide.caption && <div className="ass-caption">{slide.caption}</div>}
    </>;
  }
  return <CssOnce {...props} scope={scope}>
    <div className="ass-graphic">{slide.graphic}</div>
    {slide.caption && <div className="ass-caption">{slide.caption}</div>}
  </CssOnce>;
}
