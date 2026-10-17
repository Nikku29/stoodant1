import { useEffect, useRef } from "react";
import { TIMING } from "@/config/timing";

/**
 * Hand-drawn amber highlighter swoosh behind one phrase of a heading. Draws once with
 * stroke-dashoffset when it comes into view (high tier); static on low tier / reduced motion.
 * The text stays #0A0A0A (on dark sections the phrase turns #0A0A0A as the swoosh covers it).
 */
export function Highlight({ text, phrase, tone = "light", delay = 0 }: { text: string; phrase: string; tone?: "light" | "dark"; delay?: number }) {
  const at = phrase ? text.indexOf(phrase) : -1;
  if (at < 0) return <>{text}</>;
  // One mark per word so the heading wraps exactly as before; the swoosh bridges the spaces between words.
  const words = phrase.split(" ");
  return (
    <>
      {text.slice(0, at)}
      {words.map((word, i) => (
        <span key={i}>
          <Mark tone={tone} delay={delay + (i * TIMING.highlight.draw) / words.length} join={i < words.length - 1}>{word}</Mark>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
      {text.slice(at + phrase.length)}
    </>
  );
}

function Mark({ children, tone, delay, join }: { children: string; tone: "light" | "dark"; delay: number; join: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const animated = document.documentElement.getAttribute("data-perf") === "high" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animated) { el.classList.add("is-static"); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      el.classList.add("is-drawn");
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className={`hl hl-${tone}${join ? " hl-join" : ""}`} style={{ ["--hl-delay" as string]: `${delay}s` }}>
      <svg className="hl-swoosh" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M7 25C52 17 110 28 193 18" pathLength="1" />
      </svg>
      {children}
    </span>
  );
}
