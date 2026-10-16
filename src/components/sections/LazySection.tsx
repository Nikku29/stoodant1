import { lazy, Suspense, useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";

type SectionModule = { default: ComponentType };
export type LazySectionDef = {
  load: () => Promise<SectionModule>;
  /** Anchor id of the real section, kept on the placeholder so in-page links still resolve. */
  id?: string;
  /** Background class for the placeholder, matching the real section. */
  tone: string;
  /** Reserved height in px at <768px, 768-1023px and >=1024px (measured from the real section). */
  heights: readonly [number, number, number];
};

const NEAR_VIEWPORT = "600px 0px";
const CHANGED_EVENT = "stoodant:sections-changed";

/** Fires after any lazy section mounts, so observers that look sections up by selector can reconnect. */
export function onSectionsChanged(listener: () => void) {
  window.addEventListener(CHANGED_EVENT, listener);
  return () => window.removeEventListener(CHANGED_EVENT, listener);
}

// "Load everything" switch, used when the visitor jumps to an in-page anchor.
let loadAll = false;
const loadAllListeners = new Set<() => void>();
export function requestAllSections() {
  if (loadAll) return;
  loadAll = true;
  loadAllListeners.forEach((listener) => listener());
}

const lazyComponents = new Map<LazySectionDef["load"], ComponentType>();
function lazyComponent(load: LazySectionDef["load"]) {
  let component = lazyComponents.get(load);
  if (!component) {
    component = lazy(load);
    lazyComponents.set(load, component);
  }
  return component;
}

/** Renders a same-size placeholder until the section nears the viewport, then loads and mounts it. */
export function LazySection({ def }: { def: LazySectionDef }) {
  const slot = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return;
    const show = () => setNear(true);
    if (loadAll || typeof IntersectionObserver === "undefined") { show(); return; }
    loadAllListeners.add(show);
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) show(); }, { rootMargin: NEAR_VIEWPORT });
    if (slot.current) observer.observe(slot.current);
    return () => { loadAllListeners.delete(show); observer.disconnect(); };
  }, [near]);

  const style = { "--slot-m": `${def.heights[0]}px`, "--slot-t": `${def.heights[1]}px`, "--slot-d": `${def.heights[2]}px` } as CSSProperties;
  const placeholder = <div ref={slot} id={def.id} className={`lazy-slot ${def.tone}`} style={style} aria-hidden="true" />;
  if (!near) return placeholder;
  const Section = lazyComponent(def.load);
  return <Suspense fallback={placeholder}><Mounted><Section /></Mounted></Suspense>;
}

function Mounted({ children }: { children: ReactNode }) {
  useEffect(() => { window.dispatchEvent(new Event(CHANGED_EVENT)); }, []);
  return <>{children}</>;
}

/** Resolves once every lazy section has been loaded and mounted (no placeholders left). */
export function whenAllSectionsMounted(defs: readonly LazySectionDef[]) {
  requestAllSections();
  return Promise.all(defs.map((def) => def.load())).then(() => new Promise<void>((resolve) => {
    const started = performance.now();
    const check = () => {
      if (!document.querySelector(".lazy-slot") || performance.now() - started > 3000) resolve();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }));
}
