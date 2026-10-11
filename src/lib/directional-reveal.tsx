import { motion, useAnimationControls, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useRef, type ComponentProps, type ReactNode, type RefObject } from "react";

/**
 * Directional scroll rule (site-wide):
 * - entering from above while scrolling DOWN → reset + play from the start
 * - scrolling UP → never animates, never reverses (re-entry from above shows finished state)
 * - element fully below the viewport after scrolling UP → silently reset, ready to replay
 */
export type RevealHandlers = { play: () => void; finish: () => void; reset: () => void };

export function useDirectionalReveal(ref: RefObject<Element | null>, factory: () => RevealHandlers, enabled = true) {
  const factoryRef = useRef(factory);
  factoryRef.current = factory;
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const handlers = () => factoryRef.current();
    let previousTop = node.getBoundingClientRect().top;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      const top = entry.boundingClientRect.top;
      const viewportBottom = entry.rootBounds?.bottom ?? window.innerHeight;
      const movingDown = top <= previousTop;
      if (entry.isIntersecting) {
        if (top < 0 && !movingDown) handlers().finish();
        else if (movingDown || previousTop === top) { const current = handlers(); current.reset(); current.play(); }
      } else if (top >= viewportBottom) {
        handlers().reset();
      }
      previousTop = top;
    }, { rootMargin: "0px 0px -15% 0px", threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);
}

export const EASE = [0.22, 1, 0.36, 1] as const;
export const fadeUp: Variants = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } } };
const reducedFade: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4 } } };

type Tag = "div" | "p" | "article" | "span";
type RevealProps = { as?: Tag; variants?: Variants; children?: ReactNode } & Omit<ComponentProps<typeof motion.div>, "variants" | "initial" | "animate" | "whileInView" | "viewport" | "children">;

/** Framer Motion wrapper driven by the directional rule. Variant children (hidden/visible) follow automatically. */
export function Reveal({ as = "div", variants = fadeUp, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const controls = useAnimationControls();
  const reduced = useReducedMotion();
  useDirectionalReveal(ref, () => ({
    play: () => { void controls.start("visible"); },
    finish: () => controls.set("visible"),
    reset: () => controls.set("hidden"),
  }));
  const Component = motion[as] as typeof motion.div;
  return <Component ref={ref as RefObject<HTMLDivElement>} variants={reduced ? reducedFade : variants} initial="hidden" animate={controls} {...rest}>{children}</Component>;
}

export function FadeUp(props: RevealProps) { return <Reveal {...props} />; }

/** Count-up that follows the directional rule. */
export function Counter({ value, duration = 900 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);
  const set = (n: number) => { if (ref.current) ref.current.textContent = String(n); };
  useDirectionalReveal(ref, () => ({
    play: () => {
      cancelAnimationFrame(frame.current);
      const start = performance.now();
      const tick = (now: number) => { const t = Math.min(1, (now - start) / duration); set(Math.round(t * value)); if (t < 1) frame.current = requestAnimationFrame(tick); };
      frame.current = requestAnimationFrame(tick);
    },
    finish: () => { cancelAnimationFrame(frame.current); set(value); },
    reset: () => { cancelAnimationFrame(frame.current); set(0); },
  }));
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return <span ref={ref}>0</span>;
}

