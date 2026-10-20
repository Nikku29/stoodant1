import { lazy, Suspense, useEffect, useRef, type ComponentType, type CSSProperties, type ReactNode } from "react";

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

// Each section's code waits behind a gate that opens when the section nears the viewport.
// The prerendered page already holds every section's HTML, so crawlers and visitors without JS see the full page;
// while a gate is shut React keeps that server HTML as it is and hydrates it once the code arrives.
// After an in-app navigation there is no server HTML, so the placeholder shows until the gate opens.
type Gated = { component: ComponentType; open: () => void };
const gatedComponents = new Map<LazySectionDef["load"], Gated>();
function gatedComponent(load: LazySectionDef["load"]) {
  let gated = gatedComponents.get(load);
  if (!gated) {
    if (import.meta.env.SSR) {
      gated = { component: lazy(load), open: () => {} };
    } else {
      let open = () => {};
      const gate = new Promise<void>((resolve) => { open = resolve; });
      gated = { component: lazy(() => gate.then(load)), open };
    }
    gatedComponents.set(load, gated);
  }
  return gated;
}

// On the server the route loader loads every section first (preloadSections), so the page renders them in order,
// without suspending. A suspended section would be streamed to the end of the HTML and moved into place by a script.
const preloaded = new Map<LazySectionDef["load"], ComponentType>();
export function preloadSections(defs: readonly LazySectionDef[]) {
  return Promise.all(defs.map((def) => def.load().then((mod) => { preloaded.set(def.load, mod.default); })));
}

/** Renders the section (server HTML first), and loads its code when it nears the viewport. */
export function LazySection({ def }: { def: LazySectionDef }) {
  const mark = useRef<HTMLSpanElement>(null);
  const gated = gatedComponent(def.load);

  useEffect(() => {
    const show = gated.open;
    if (loadAll || typeof IntersectionObserver === "undefined") { show(); return; }
    loadAllListeners.add(show);
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) show(); }, { rootMargin: NEAR_VIEWPORT });
    if (mark.current) observer.observe(mark.current);
    return () => { loadAllListeners.delete(show); observer.disconnect(); };
  }, [gated]);

  const style = { "--slot-m": `${def.heights[0]}px`, "--slot-t": `${def.heights[1]}px`, "--slot-d": `${def.heights[2]}px` } as CSSProperties;
  const placeholder = <div id={def.id} className={`lazy-slot ${def.tone}`} style={style} aria-hidden="true" />;
  const Section = (import.meta.env.SSR && preloaded.get(def.load)) || gated.component;
  return <><span ref={mark} className="lazy-mark" aria-hidden="true" /><Suspense fallback={placeholder}><Mounted><Section /></Mounted></Suspense></>;
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
