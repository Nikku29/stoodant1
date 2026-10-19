import { useEffect, useId, useRef, type RefObject } from "react";
import { buildLogo, LOGO_LABEL, logoViewBox, PUPIL_OFFSET, type LogoTone, type LogoVariant } from "./logoMarkup";

type LogoProps = {
  variant?: LogoVariant;
  /** "light": navy letters for light backgrounds. "dark": white letters for dark backgrounds; amber stays. */
  tone?: LogoTone;
  /** "blink": periodic CSS blink (high tier, paused offscreen). "intro": the splash sequence. */
  animate?: "none" | "blink" | "intro";
  /** Pupils follow the pointer (fine pointers only). */
  follow?: boolean;
  className?: string;
};

/** The only Stoodant logo. Markup comes from logoMarkup.ts, shared with the splash and favicon. */
export function Logo({ variant = "full", tone = "light", animate = "none", follow = false, className = "" }: LogoProps) {
  const ref = useRef<SVGSVGElement>(null);
  const prefix = `lg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  usePauseOffscreen(ref, animate === "blink");
  usePupilFollow(ref, follow);
  return (
    <svg
      ref={ref}
      viewBox={logoViewBox(variant)}
      role="img"
      aria-label={LOGO_LABEL}
      className={`brand-logo lg-${variant} lg-anim-${animate} ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: buildLogo(variant, tone, prefix) }}
    />
  );
}

function usePauseOffscreen(ref: RefObject<SVGSVGElement | null>, on: boolean) {
  useEffect(() => {
    const svg = ref.current;
    if (!on || !svg) return;
    const io = new IntersectionObserver(([entry]) => svg.classList.toggle("is-paused", !entry?.isIntersecting));
    io.observe(svg);
    return () => io.disconnect();
  }, [ref, on]);
}

// Resting pupil offset from the eye centre and how far a pupil may travel (SVG units).
const PUPIL_REST = PUPIL_OFFSET;
const PUPIL_REACH = 24;

function usePupilFollow(ref: RefObject<SVGSVGElement | null>, on: boolean) {
  useEffect(() => {
    const svg = ref.current;
    if (!on || !svg || !window.matchMedia("(pointer: fine)").matches) return;
    const looks = Array.from(svg.querySelectorAll<SVGGElement>(".lg-look"));
    const eyes = Array.from(svg.querySelectorAll<SVGCircleElement>(".lg-eye"));
    let frame = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      frame = 0;
      looks.forEach((look, i) => {
        const box = eyes[i]?.getBoundingClientRect();
        if (!box?.width) return;
        const dx = px - (box.left + box.width / 2);
        const dy = py - (box.top + box.height / 2);
        const distance = Math.hypot(dx, dy) || 1;
        // Full reach once the pointer is a few eye-widths away; gentler when close.
        const reach = PUPIL_REACH * Math.min(1, distance / (box.width * 2.5));
        const tx = (dx / distance) * reach - PUPIL_REST.x;
        const ty = (dy / distance) * reach - PUPIL_REST.y;
        look.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px)`;
      });
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      px = event.clientX;
      py = event.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const reset = () => looks.forEach((look) => look.style.removeProperty("transform"));
    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
      reset();
    };
  }, [ref, on]);
}
