import { AnimatePresence, LazyMotion, m, useReducedMotion } from "framer-motion";
import { ArrowDownRight, Menu, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { getOfferText, isOfferActive } from "@/lib/pricing";
import { HeroSubjectDeck } from "@/components/HeroSubjectDeck";
import { EASE, Logo } from "@/components/sections/shared";
import { LazySection, onSectionsChanged, whenAllSectionsMounted, type LazySectionDef } from "@/components/sections/LazySection";
import { detectPerfTier } from "@/lib/perf";
import { TIMING } from "@/config/timing";

const loadMotionFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

// Everything below the hero loads when it nears the viewport. Heights are measured from the real
// sections at 390px, 768px and 1280px wide and reserve the space so nothing jumps.
const MAIN_SECTIONS: LazySectionDef[] = [
  { load: () => import("@/components/sections/ProblemSection"), tone: "section-dark", heights: [768, 958, 649] },
  { load: () => import("@/components/sections/GapSection"), tone: "section-off", heights: [915, 749, 721] },
  { load: () => import("@/components/sections/ProcessSection"), id: "how-it-works", tone: "section-light", heights: [1263, 1195, 906] },
  { load: () => import("@/components/sections/AheadSection"), tone: "section-dark", heights: [768, 958, 649] },
  { load: () => import("@/components/sections/PricingSection"), id: "batches", tone: "section-off", heights: [3179, 1823, 1273] },
  { load: () => import("@/components/sections/ComparisonSection"), id: "why-stoodant", tone: "section-light", heights: [921, 846, 993] },
  { load: () => import("@/components/sections/SubjectsSection"), id: "subjects", tone: "section-dark", heights: [600, 606, 753] },
  { load: () => import("@/components/sections/TeachersSection"), tone: "lazy-slot-ink", heights: [1023, 1039, 1113] },
  { load: () => import("@/components/sections/ProgressSection"), tone: "section-light", heights: [1192, 1007, 1101] },
  { load: () => import("@/components/sections/TestimonialsSection"), tone: "section-off", heights: [1159, 673, 700] },
  { load: () => import("@/components/sections/FaqSection"), id: "faq", tone: "section-light", heights: [983, 940, 781] },
  { load: () => import("@/components/sections/FinalCta"), id: "demo", tone: "section-dark", heights: [1196, 1226, 847] },
];
const FOOTER: LazySectionDef = { load: () => import("@/components/sections/Footer"), tone: "section-dark", heights: [827, 498, 498] };
const ALL_SECTIONS = [...MAIN_SECTIONS, FOOTER];

export function StoodantLanding() {
  const reduceMotion = useReducedMotion();
  useLazyAnchors();

  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <div className="site-shell">
      <Loader disabled={Boolean(reduceMotion)} />
      <CustomCursor />
      <Header />
      <main>
        <Hero />
        {MAIN_SECTIONS.map((def, index) => <LazySection key={index} def={def} />)}
      </main>
      <LazySection def={FOOTER} />
      <WhatsappButton />
    </div>
    </LazyMotion>
  );
}

/** In-page links (#batches, #faq, #demo...) and a hash in the URL: load every section first, then jump. */
function useLazyAnchors() {
  useEffect(() => {
    const ids = new Set(ALL_SECTIONS.map((def) => def.id).filter(Boolean));
    const jump = (hash: string) => {
      const id = decodeURIComponent(hash.slice(1));
      if (!ids.has(id)) return false;
      void whenAllSectionsMounted(ALL_SECTIONS).then(() => document.getElementById(id)?.scrollIntoView());
      return true;
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href^='#']");
      const href = link?.getAttribute("href");
      if (!href || !jump(href)) return;
      event.preventDefault();
      if (location.hash !== href) history.pushState(null, "", href);
    };
    const onHashChange = () => { jump(location.hash); };
    if (location.hash) jump(location.hash);
    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", onHashChange);
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("hashchange", onHashChange); };
  }, []);
}

function Loader({ disabled }: { disabled: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Never on the low tier (phones, weak devices, reduced motion); first visit only elsewhere. It mounts
    // after hydration, so the hero has already painted underneath it.
    if (disabled || detectPerfTier() === "low" || sessionStorage.getItem("stoodant-loaded")) return;
    setVisible(true);
    const timeout = window.setTimeout(() => { setVisible(false); sessionStorage.setItem("stoodant-loaded", "1"); }, 1900);
    return () => window.clearTimeout(timeout);
  }, [disabled]);
  return (
    <AnimatePresence>
      {visible && (
        <m.div className="loader" initial={{ y: 0 }} exit={{ y: "-100%" }} transition={{ duration: 0.6, ease: EASE }}>
          <svg viewBox="0 0 130 62" aria-hidden="true"><path d="M8 31C22 3 45 3 65 31s43 28 57 0C108 3 85 3 65 31S22 59 8 31Z" /></svg>
          <m.strong initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05, duration: 0.5 }}>{SITE_CONFIG.brand.name.toUpperCase()}</m.strong>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    const hide = () => {
      dot.current?.classList.remove("is-visible");
      ring.current?.classList.remove("is-visible", "is-active");
    };
    const move = (event: PointerEvent) => {
      if (!finePointer.matches || event.pointerType === "touch") { hide(); return; }
      dot.current?.style.setProperty("transform", `translate3d(${event.clientX - 6}px,${event.clientY - 6}px,0)`);
      ring.current?.style.setProperty("transform", `translate3d(${event.clientX - 18}px,${event.clientY - 18}px,0)`);
      dot.current?.classList.add("is-visible");
      ring.current?.classList.add("is-visible");
      ring.current?.classList.toggle("is-active", Boolean((event.target as Element).closest("a,button,input,select")));
    };
    const onVisibilityChange = () => { if (document.hidden) hide(); };
    document.addEventListener("pointermove", move);
    document.documentElement.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    finePointer.addEventListener("change", hide);
    return () => {
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      finePointer.removeEventListener("change", hide);
    };
  }, []);
  return <><div ref={dot} className="cursor-dot" aria-hidden="true" /><div ref={ring} className="cursor-ring" aria-hidden="true" /></>;
}

function Header() {
  const [menu, setMenu] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [overDark, setOverDark] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => setDismissed(sessionStorage.getItem("stoodant-offer-dismissed") === "1"), []);
  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const observed = new Set<Element>();
    const connect = () => {
      observer?.disconnect();
      observed.clear();
      const nav = navRef.current;
      if (!nav) return;
      const y = nav.getBoundingClientRect().top + nav.getBoundingClientRect().height / 2;
      const bottomMargin = Math.max(0, window.innerHeight - y - 1);
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => entry.isIntersecting ? observed.add(entry.target) : observed.delete(entry.target));
        setOverDark(observed.size > 0);
      }, { rootMargin: `${-y}px 0px ${-bottomMargin}px 0px`, threshold: 0 });
      document.querySelectorAll<HTMLElement>("main .section-dark, footer, .lazy-slot.section-dark").forEach((section) => observer?.observe(section));
    };
    connect();
    window.addEventListener("resize", connect);
    const offSections = onSectionsChanged(connect);
    return () => { observer?.disconnect(); window.removeEventListener("resize", connect); offSections(); };
  }, []);
  const showOffer = isOfferActive() && !dismissed;
  const closeOffer = () => { setDismissed(true); sessionStorage.setItem("stoodant-offer-dismissed", "1"); };
  return (
    <>
      {showOffer && <div className="announcement"><span>{getOfferText()}</span><button onClick={closeOffer} aria-label="Dismiss offer"><X size={16} /></button></div>}
      <header ref={navRef} className={`navbar${overDark ? " navbar-dark" : ""}`}>
        <div className="nav-inner">
          <Logo inverse={overDark} />
          <nav className="desktop-nav" aria-label="Main navigation">
            {SITE_CONFIG.navigation.links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
          </nav>
          <a href="#demo" className={`button ${overDark ? "button-light" : "button-dark"} nav-cta`}>{SITE_CONFIG.navigation.cta}</a>
          <button className="menu-button" aria-label={SITE_CONFIG.navigation.menuOpen} aria-expanded={menu} onClick={() => setMenu(true)}><Menu /></button>
        </div>
      </header>
      <AnimatePresence>
        {menu && <m.div className="mobile-menu" initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }} transition={{ duration: 0.6, ease: EASE }}>
          <button aria-label={SITE_CONFIG.navigation.menuClose} onClick={() => setMenu(false)}><X /></button>
          <Logo inverse />
          <nav>{SITE_CONFIG.navigation.links.map((link) => <a key={link.href} href={link.href} onClick={() => setMenu(false)}>{link.label}</a>)}</nav>
          <a href="#demo" onClick={() => setMenu(false)}>{SITE_CONFIG.navigation.cta}<ArrowDownRight /></a>
        </m.div>}
      </AnimatePresence>
    </>
  );
}

function MagneticLink({ href, children, outline = false }: { href: string; children: ReactNode; outline?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const move = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 16;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 16;
    ref.current?.style.setProperty("transform", `translate(${x}px,${y}px)`);
  };
  return <a ref={ref} href={href} onMouseMove={move} onMouseLeave={() => ref.current?.style.setProperty("transform", "translate(0,0)")} className={`button ${outline ? "button-outline" : "button-dark"}`}>{children}<ArrowDownRight size={18} /></a>;
}

const heroRise = { animationDuration: `${TIMING.heroEntrance}s` };

function Hero() {
  return (
    <section id="top" className="hero section-light">
      <FloatingShapes />
      <div className="container hero-grid">
        <div className="hero-copy">
          {/* Entrance runs in CSS from the first paint, so the hero never waits for JavaScript. */}
          <h1>{SITE_CONFIG.hero.headline.map((line, index) => <span className="line-mask" key={line}><span className="hero-line" style={{ animationDuration: `${TIMING.heroEntrance}s`, animationDelay: `${TIMING.heroLineDelay + index * TIMING.heroLineStagger}s` }}>{line}</span></span>)}</h1>
          <p className="hero-rise" style={heroRise}>{SITE_CONFIG.hero.subhead}</p>
          <div className="hero-actions hero-rise" style={heroRise}><MagneticLink href="#demo">{SITE_CONFIG.hero.primaryCta}</MagneticLink><MagneticLink href="#batches" outline>{SITE_CONFIG.hero.secondaryCta}</MagneticLink></div>
          <small className="hero-rise" style={heroRise}>{SITE_CONFIG.hero.trust}</small>
        </div>
        <HeroSubjectDeck />
      </div>
    </section>
  );
}

function FloatingShapes() {
  return <div className="floating-shapes" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <m.svg key={i} viewBox="0 0 80 80" animate={{ y: [0, -14 - i, 0], rotate: [0, i % 2 ? 5 : -5, 0] }} transition={{ duration: 7 + i, repeat: Infinity, ease: "easeInOut" }}><rect x="16" y="20" width="48" height="40" rx="4" /><path d={i % 3 === 0 ? "M22 30h36M22 40h28M22 50h20" : i % 3 === 1 ? "M18 58 58 18l5 5-40 40Z" : "M18 44h44M22 35l10-10 8 8 16-16"} /></m.svg>)}</div>;
}

function WhatsappButton() { const [hidden, setHidden] = useState(false); useEffect(() => {
    // The form and footer load lazily, so look them up again whenever a section mounts.
    let io: IntersectionObserver | null = null;
    const connect = () => { io?.disconnect(); const targets = [document.querySelector("#demo form, #demo .form-wrap"), document.querySelector("footer")].filter(Boolean) as Element[]; const seen = new Set<Element>(); io = new IntersectionObserver((entries) => { entries.forEach((e) => e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)); setHidden(seen.size > 0); }); targets.forEach((t) => io?.observe(t)); };
    connect();
    const offSections = onSectionsChanged(connect);
    return () => { io?.disconnect(); offSections(); };
  }, []); const href = `https://wa.me/${SITE_CONFIG.contact.whatsapp}?text=${encodeURIComponent(SITE_CONFIG.whatsapp.message)}`; return <a className={hidden ? "whatsapp is-hidden" : "whatsapp"} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined} href={href} target="_blank" rel="noreferrer" aria-label={SITE_CONFIG.whatsapp.label}><MessageCircle /></a>; }
