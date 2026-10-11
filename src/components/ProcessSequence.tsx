import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type TouchEvent } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";

const INTERVAL = 3000;

export function ProcessSequence() {
  const root = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const steps = SITE_CONFIG.process.steps;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let wasVisible = false;
    const observer = new IntersectionObserver(([entry]) => {
      const isVisible = Boolean(entry?.isIntersecting);
      if (isVisible && !wasVisible) {
        setActive(0);
        setCycle((current) => current + 1);
      }
      wasVisible = isVisible;
      setVisible(isVisible);
    }, { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const go = useCallback((next: number) => {
    setActive((next + steps.length) % steps.length);
    setCycle((current) => current + 1);
  }, [steps.length]);

  const running = playing && visible && !hovered && !focused && !reduced;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") { event.preventDefault(); go(active + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(active - 1); }
  };
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchX.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(distance) > 40) go(distance < 0 ? active + 1 : active - 1);
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  };

  return (
    <div
      ref={root}
      className={`process-sequence${reduced ? " is-reduced" : ""}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="How Stoodant works"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="process-map">
        <svg viewBox="0 0 1200 340" preserveAspectRatio="none" aria-hidden="true">
          <path className="process-path-base" pathLength="1" d="M40 230C190 40 305 40 440 200s250 145 370-15 230-125 350-55" />
          <path className="process-path-progress" pathLength="1" style={{ strokeDashoffset: 1 - active / (steps.length - 1) }} d="M40 230C190 40 305 40 440 200s250 145 370-15 230-125 350-55" />
        </svg>
        <div className="process-steps">
          {steps.map((step, index) => (
            <article key={step.number} className={index <= active ? "is-lit" : ""} aria-current={index === active ? "step" : undefined}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="process-controls">
        <button type="button" className="process-control" aria-label="Previous step" onClick={() => go(active - 1)}><ChevronLeft size={20} /></button>
        <button type="button" className="process-control" aria-label={playing ? "Pause sequence" : "Play sequence"} onClick={() => setPlaying((current) => !current)}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <div className="process-dots">
          {steps.map((step, index) => (
            <button type="button" key={step.number} className={`process-dot${index === active ? " is-active" : ""}`} aria-label={`Go to step ${index + 1}: ${step.title}`} aria-current={index === active ? "step" : undefined} onClick={() => go(index)}>
              <span>{index === active && !reduced && <i key={cycle} style={{ animationDuration: `${INTERVAL}ms`, animationPlayState: running ? "running" : "paused" }} onAnimationEnd={(event) => { if (event.target === event.currentTarget) go(active + 1); }} />}</span>
            </button>
          ))}
        </div>
        <button type="button" className="process-control" aria-label="Next step" onClick={() => go(active + 1)}><ChevronRight size={20} /></button>
      </div>
      <p className="sr-only" aria-live="polite">{`Step ${active + 1} of ${steps.length}: ${steps[active]?.title ?? ""}`}</p>
    </div>
  );
}