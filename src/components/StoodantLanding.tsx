import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, Check, ChevronDown, Menu, MessageCircle, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { formatINR, getOfferText, getPrice, isOfferActive } from "@/lib/pricing";
import { HeroSubjectDeck } from "@/components/HeroSubjectDeck";
import { AutoStory } from "@/components/AutoStory";
import { PROBLEM_GRAPHICS } from "@/components/ProblemSlides";
import { AHEAD_SLIDES } from "@/components/AheadSlides";
import { ProcessSequence } from "@/components/ProcessSequence";
import { TeachersRing } from "@/components/TeachersRing";
import { Counter, Reveal } from "@/lib/directional-reveal";

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } } };
const FinalCtaInfinityRibbon = lazy(() => import("@/components/FinalCtaInfinityRibbon"));

export function StoodantLanding() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="site-shell">
      <Loader disabled={Boolean(reduceMotion)} />
      <CustomCursor />
      <Header />
      <main>
        <Hero />
        <ProblemSection reduced={Boolean(reduceMotion)} />
        <GapSection />
        <ProcessSection />
        <AheadSection reduced={Boolean(reduceMotion)} />
        <PricingSection />
        <ComparisonSection />
        <SubjectsSection />
        <TeachersSection />
        <ProgressSection />
        <TestimonialsSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
      <WhatsappButton />
    </div>
  );
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  const color = inverse ? "var(--white)" : "var(--ink)";
  return (
    <a href="#top" className="logo" aria-label={`${SITE_CONFIG.brand.name} home`}>
      <svg viewBox="0 0 194 30" role="img" aria-label={SITE_CONFIG.brand.name}>
        <text x="0" y="24" fill={color} className="logo-text">ST</text>
        <path d="M40 15c8-15 20-15 28 0 8 15 20 15 28 0C88 0 76 0 68 15 60 30 48 30 40 15Z" fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="101" y="24" fill={color} className="logo-text">DANT</text>
      </svg>
      <span>{SITE_CONFIG.brand.tagline}</span>
    </a>
  );
}

function Loader({ disabled }: { disabled: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (disabled || sessionStorage.getItem("stoodant-loaded")) return;
    setVisible(true);
    const timeout = window.setTimeout(() => { setVisible(false); sessionStorage.setItem("stoodant-loaded", "1"); }, 1900);
    return () => window.clearTimeout(timeout);
  }, [disabled]);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="loader" initial={{ y: 0 }} exit={{ y: "-100%" }} transition={{ duration: 0.6, ease: EASE }}>
          <svg viewBox="0 0 130 62" aria-hidden="true"><path d="M8 31C22 3 45 3 65 31s43 28 57 0C108 3 85 3 65 31S22 59 8 31Z" /></svg>
          <motion.strong initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05, duration: 0.5 }}>{SITE_CONFIG.brand.name.toUpperCase()}</motion.strong>
        </motion.div>
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

function OfferBadge() {
  if (!isOfferActive()) return null;
  return <span className="offer-badge">{getOfferText()}</span>;
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
      document.querySelectorAll<HTMLElement>("main .section-dark, footer").forEach((section) => observer?.observe(section));
    };
    connect();
    window.addEventListener("resize", connect);
    return () => { observer?.disconnect(); window.removeEventListener("resize", connect); };
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
        {menu && <motion.div className="mobile-menu" initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }} transition={{ duration: 0.6, ease: EASE }}>
          <button aria-label={SITE_CONFIG.navigation.menuClose} onClick={() => setMenu(false)}><X /></button>
          <Logo inverse />
          <nav>{SITE_CONFIG.navigation.links.map((link) => <a key={link.href} href={link.href} onClick={() => setMenu(false)}>{link.label}</a>)}</nav>
          <a href="#demo" onClick={() => setMenu(false)}>{SITE_CONFIG.navigation.cta}<ArrowDownRight /></a>
        </motion.div>}
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

function Hero() {
  return (
    <section id="top" className="hero section-light">
      <FloatingShapes />
      <div className="container hero-grid">
        <div className="hero-copy">
          <h1>{SITE_CONFIG.hero.headline.map((line, index) => <span className="line-mask" key={line}><motion.span initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ delay: .3 + index * .12, duration: .8, ease: EASE }}>{line}</motion.span></span>)}</h1>
          <motion.p variants={reveal} initial="hidden" animate="visible" transition={{ delay: .55 }}>{SITE_CONFIG.hero.subhead}</motion.p>
          <motion.div className="hero-actions" variants={reveal} initial="hidden" animate="visible"><MagneticLink href="#demo">{SITE_CONFIG.hero.primaryCta}</MagneticLink><MagneticLink href="#batches" outline>{SITE_CONFIG.hero.secondaryCta}</MagneticLink></motion.div>
          <motion.small variants={reveal} initial="hidden" animate="visible">{SITE_CONFIG.hero.trust}</motion.small>
        </div>
        <HeroSubjectDeck />
      </div>
    </section>
  );
}

function FloatingShapes() {
  return <div className="floating-shapes" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <motion.svg key={i} viewBox="0 0 80 80" animate={{ y: [0, -14 - i, 0], rotate: [0, i % 2 ? 5 : -5, 0] }} transition={{ duration: 7 + i, repeat: Infinity, ease: "easeInOut" }}><rect x="16" y="20" width="48" height="40" rx="4" /><path d={i % 3 === 0 ? "M22 30h36M22 40h28M22 50h20" : i % 3 === 1 ? "M18 58 58 18l5 5-40 40Z" : "M18 44h44M22 35l10-10 8 8 16-16"} /></motion.svg>)}</div>;
}

function SectionHeading({ kicker, children, inverse = false }: { kicker: string; children: string; inverse?: boolean }) {
  return <Reveal className={`section-heading ${inverse ? "inverse" : ""}`} variants={GROUP}><motion.span variants={reveal}>{kicker}</motion.span><h2>{children.split(" ").map((word, i) => <span className="word-mask" key={`${word}-${i}`}><motion.i variants={{ hidden: { y: "115%" }, visible: { y: 0, transition: { duration: .8, delay: i * .08, ease: EASE } } }}>{word}&nbsp;</motion.i></span>)}</h2></Reveal>;
}

function ProblemSection(_: { reduced: boolean }) {
  const slides = SITE_CONFIG.problem.beats.map((beat) => ({ title: beat.title, ...PROBLEM_GRAPHICS[beat.type]! }));
  return <section className="story-section section-dark problem-slides"><div className="container story-grid"><div><SectionHeading kicker={SITE_CONFIG.problem.kicker} inverse>{SITE_CONFIG.problem.title}</SectionHeading><p className="story-note">{SITE_CONFIG.problem.note}</p></div><AutoStory slides={slides} label="The challenge, in four slides" /></div></section>;
}

function Divider({ inverse = false }: { inverse?: boolean }) { return <div className={`divider ${inverse ? "inverse" : ""}`}><svg viewBox="0 0 130 54"><path d="M7 27C22 2 44 2 65 27s43 25 58 0C108 2 86 2 65 27S22 52 7 27Z" /></svg></div>; }

function GapSection() {
  return <section className="gap-section section-off"><div className="container"><SectionHeading kicker={SITE_CONFIG.gap.kicker}>{SITE_CONFIG.gap.headline}</SectionHeading><div className="gap-copy">{SITE_CONFIG.gap.paragraphs.map((p) => <Reveal as="p" key={p}>{p}</Reveal>)}</div><Reveal className="class-timeline" variants={GROUP}>{SITE_CONFIG.gap.classes.map((grade, i) => <motion.div key={grade} variants={{ hidden: { opacity: .15 }, visible: { opacity: 1, transition: { delay: i * .14, duration: .5 } } }}><span>{grade}</span></motion.div>)}<div className="beyond"><small>{SITE_CONFIG.gap.focus}</small><strong>{SITE_CONFIG.gap.beyond}</strong></div></Reveal></div><Divider /></section>;
}

const GROUP = { hidden: {}, visible: {} };

function ProcessSection() {
  return <section id="how-it-works" className="process-section section-light"><div className="container"><SectionHeading kicker={SITE_CONFIG.process.kicker}>{SITE_CONFIG.process.headline}</SectionHeading><ProcessSequence /></div></section>;
}

function AheadSection(_: { reduced: boolean }) {
  return <section className="story-section section-dark ahead-slides"><div className="container story-grid"><div><SectionHeading kicker={SITE_CONFIG.ahead.kicker} inverse>{SITE_CONFIG.ahead.headline}</SectionHeading><Reveal as="p" className="story-note">{SITE_CONFIG.ahead.explanation}</Reveal></div><AutoStory slides={AHEAD_SLIDES} label="Stay ahead, in three slides" /></div></section>;
}

function PricingSection() {
  return <section id="batches" className="pricing-section section-off"><div className="container"><SectionHeading kicker={SITE_CONFIG.pricing.kicker}>{SITE_CONFIG.pricing.heading}</SectionHeading><div className="pricing-intro"><p>{SITE_CONFIG.pricing.subtext}</p><OfferBadge /></div><div className="pricing-grid">{SITE_CONFIG.batches.map((batch) => <PricingCard key={batch.id} batch={batch} />)}</div><p className="pricing-note">{SITE_CONFIG.pricing.note}</p></div></section>;
}

type Batch = (typeof SITE_CONFIG.batches)[number];
function PricingCard({ batch }: { batch: Batch }) {
  const price = getPrice(batch.basePrice); const detail = SITE_CONFIG.pricing.details[batch.id];
  return <Reveal as="article" className={`pricing-card ${batch.popular ? "popular" : ""}`} whileHover={{ y: -6 }} whileTap={{ y: -3 }}>{batch.popular && <span className="ribbon">{SITE_CONFIG.pricing.popular}</span>}<div className="ratio-row"><strong>{batch.ratio}</strong><span>{batch.name}</span></div><div className="price-block">{isOfferActive() && <del>{formatINR(price.original)}</del>}<div><b>{formatINR(price.final)}</b><span>{SITE_CONFIG.pricing.perMonth}</span></div>{isOfferActive() && <em>{SITE_CONFIG.pricing.save} {formatINR(price.saved)}</em>}</div><DotClass students={batch.students} /><p className="best-for">{detail.bestFor}</p><ul>{detail.benefits.map((benefit) => <li key={benefit}><Check size={15} />{benefit}</li>)}</ul><a className={`button ${batch.popular ? "button-light" : "button-dark"}`} href="#demo">{SITE_CONFIG.pricing.button}<ArrowDownRight size={17} /></a></Reveal>;
}

function DotClass({ students }: { students: number }) {
  return <div className="dot-class"><div className="dot-legend"><span><i className="teacher-dot" />{SITE_CONFIG.pricing.teacher}</span><span><i />{SITE_CONFIG.pricing.students}</span></div><div className="dot-field"><i className="teacher-dot" />{Array.from({ length: students }, (_, i) => <motion.i key={i} variants={{ hidden: { opacity: 0, scale: 0 }, visible: { opacity: 1, scale: 1, transition: { delay: i * .05 } } }} style={{ animationDelay: `${i * .08}s` }} />)}</div></div>;
}

function ComparisonSection() {
  return <section id="why-stoodant" className="comparison-section section-light"><div className="container"><SectionHeading kicker={SITE_CONFIG.comparison.kicker}>{SITE_CONFIG.comparison.headline}</SectionHeading><div className="comparison-table"><div className="comparison-head"><span>{SITE_CONFIG.comparison.columns[0]}</span><strong>{SITE_CONFIG.comparison.columns[1]}</strong></div>{SITE_CONFIG.comparison.rows.map((row, i) => <Reveal className="comparison-row" key={row[0]} variants={{ hidden: { opacity: 0, x: -40 }, visible: { opacity: 1, x: 0, transition: { delay: i * .08, duration: .8, ease: EASE } } }}><span>{row[0]}</span><strong><Check />{row[1]}</strong></Reveal>)}</div></div><Divider /></section>;
}

function SubjectsSection() {
  return <section id="subjects" className="subjects-section section-dark"><div className="container"><SectionHeading kicker={SITE_CONFIG.subjects.kicker} inverse>{SITE_CONFIG.subjects.headline}</SectionHeading></div><Marquee values={SITE_CONFIG.subjects.rowOne} /><Marquee values={SITE_CONFIG.subjects.rowTwo} reverse /></section>;
}
function Marquee({ values, reverse = false }: { values: readonly string[]; reverse?: boolean }) { const doubled = [...values, ...values]; return <div className="marquee"><div className={reverse ? "marquee-track reverse" : "marquee-track"}>{doubled.map((item, i) => <span key={`${item}-${i}`}>{item}<i /></span>)}</div></div>; }

function TeachersSection() {
  return <section className="teachers-section section-off"><div className="container"><SectionHeading kicker={SITE_CONFIG.teachers.kicker}>{SITE_CONFIG.teachers.headline}</SectionHeading></div><Reveal><TeachersRing /></Reveal></section>;
}

function ProgressSection() {
  return <section className="progress-section section-light"><div className="container"><SectionHeading kicker={SITE_CONFIG.progress.kicker}>{SITE_CONFIG.progress.headline}</SectionHeading><Reveal className="dashboard"><div className="dashboard-top"><strong>{SITE_CONFIG.progress.week}</strong><span>{SITE_CONFIG.progress.sample}</span></div><div className="rings">{SITE_CONFIG.progress.rings.map((ring) => <ProgressRing key={ring.label} {...ring} />)}</div><div className="dashboard-lower"><div className="bar-chart">{SITE_CONFIG.progress.bars.map((bar, i) => <div key={i}><motion.i variants={{ hidden: { scaleY: 0 }, visible: { scaleY: 1, transition: { delay: i * .08, duration: .8, ease: EASE } } }} style={{ height: `${bar}%` }} /><span>{SITE_CONFIG.progress.days[i]}</span></div>)}</div><div className="report-card"><span>01 / 01</span><h3>{SITE_CONFIG.progress.reportTitle}</h3><p>{SITE_CONFIG.progress.reportCopy}</p></div></div></Reveal></div></section>;
}
function ProgressRing({ label, value }: { label: string; value: number }) { return <div className="ring-item"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42"/><motion.circle className="ring-value" cx="50" cy="50" r="42" variants={{ hidden: { pathLength: 0 }, visible: { pathLength: value / 100, transition: { duration: 1.3, ease: EASE } } }} /></svg><strong><Counter value={value} />%</strong><span>{label}</span></div>; }

function TestimonialsSection() { return <section className="testimonials-section section-off"><div className="container"><SectionHeading kicker={SITE_CONFIG.testimonials.kicker}>{SITE_CONFIG.testimonials.headline}</SectionHeading><div className="testimonial-grid">{SITE_CONFIG.testimonials.cards.map((card, i) => <Reveal as="article" key={i}><span>“</span><p>{card}</p><i /></Reveal>)}</div></div></section>; }

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return <section id="faq" className="faq-section section-light"><div className="container faq-grid"><SectionHeading kicker={SITE_CONFIG.faq.kicker}>{SITE_CONFIG.faq.headline}</SectionHeading><div className="accordion">{SITE_CONFIG.faq.items.map((item, i) => <div className="faq-item" key={item.q}><button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}><span>{item.q}</span><ChevronDown className={open === i ? "rotated" : ""} /></button><AnimatePresence initial={false}>{open === i && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .35, ease: EASE }}><p>{item.a}</p></motion.div>}</AnimatePresence></div>)}</div></div></section>;
}

function FinalCta() {
  const [success, setSuccess] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({});
  const section = useRef<HTMLElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [supportsRibbon, setSupportsRibbon] = useState(false);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 767px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const checkSupport = () => {
      if (narrow.matches || reduced.matches) { setSupportsRibbon(false); return; }
      const canvas = document.createElement("canvas");
      setSupportsRibbon(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
    };
    checkSupport();
    narrow.addEventListener("change", checkSupport);
    reduced.addEventListener("change", checkSupport);
    return () => { narrow.removeEventListener("change", checkSupport); reduced.removeEventListener("change", checkSupport); };
  }, []);
  useEffect(() => {
    const node = section.current;
    if (!node || nearViewport) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setNearViewport(true);
      observer.disconnect();
    }, { rootMargin: "350px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nearViewport]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const values = Object.fromEntries(data); const next: Record<string, string> = {};
    if (!String(values["studentName"] ?? "").trim()) next["studentName"] = SITE_CONFIG.form.errors.name;
    if (!values["studentClass"]) next["studentClass"] = SITE_CONFIG.form.errors.className;
    if (!values["board"]) next["board"] = SITE_CONFIG.form.errors.board;
    if (!/^[6-9]\d{9}$/.test(String(values["phone"] ?? ""))) next["phone"] = SITE_CONFIG.form.errors.phone;
    setErrors(next); if (Object.keys(next).length) return;
    console.log("TODO: Connect demo request to Lovable Cloud or email", values); setSuccess(true);
  };
  const fallbackLoop = <svg className={success ? "cta-loop complete" : "cta-loop"} viewBox="0 0 300 135"><path d="M15 67C45 5 100 5 150 67s105 62 135 0C255 5 200 5 150 67S45 129 15 67Z" /></svg>;
  return <section ref={section} id="demo" className="final-cta section-dark"><div className="container final-grid"><div><span className="eyebrow inverse">{SITE_CONFIG.form.kicker}</span><h2>{SITE_CONFIG.form.headline}</h2>{nearViewport && supportsRibbon ? <Suspense fallback={fallbackLoop}><FinalCtaInfinityRibbon success={success} /></Suspense> : fallbackLoop}</div><div className="form-wrap"><OfferBadge />{success ? <motion.div className="success" role="status" aria-live="polite" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}><Check /><h3>{SITE_CONFIG.form.success}</h3></motion.div> : <form onSubmit={submit} noValidate><Field label={SITE_CONFIG.form.studentName} error={errors["studentName"]}><input name="studentName" placeholder={SITE_CONFIG.form.studentPlaceholder} maxLength={80} aria-invalid={Boolean(errors["studentName"])} /></Field><div className="form-row"><Field label={SITE_CONFIG.form.classLabel} error={errors["studentClass"]}><select name="studentClass" defaultValue=""><option value="" disabled>{SITE_CONFIG.form.classPlaceholder}</option>{SITE_CONFIG.form.classes.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label={SITE_CONFIG.form.boardLabel} error={errors["board"]}><select name="board" defaultValue=""><option value="" disabled>{SITE_CONFIG.form.boardPlaceholder}</option>{SITE_CONFIG.form.boards.map((item) => <option key={item}>{item}</option>)}</select></Field></div><Field label={SITE_CONFIG.form.phoneLabel} error={errors["phone"]}><input name="phone" type="tel" inputMode="numeric" maxLength={10} placeholder={SITE_CONFIG.form.phonePlaceholder} aria-invalid={Boolean(errors["phone"])} /></Field><button className="button button-light" type="submit">{SITE_CONFIG.form.submit}<ArrowDownRight /></button></form>}</div></div></section>;
}
function Field({ label, error, children }: { label: string; error: string | undefined; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}{error && <small role="alert">{error}</small>}</label>; }

function Footer() {
  return <footer><div className="container footer-grid"><Logo inverse /><div><strong>{SITE_CONFIG.footer.quickLinks}</strong>{SITE_CONFIG.navigation.links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</div><div><strong>{SITE_CONFIG.footer.contact}</strong><a href={`tel:${SITE_CONFIG.contact.phone}`}>{SITE_CONFIG.contact.phone}</a><a href={`mailto:${SITE_CONFIG.contact.email}`}>{SITE_CONFIG.contact.email}</a></div></div><div className="container copyright">© {new Date().getFullYear()} {SITE_CONFIG.brand.name}. {SITE_CONFIG.footer.rights}</div></footer>;
}
function WhatsappButton() { const [hidden, setHidden] = useState(false); useEffect(() => { const targets = [document.querySelector("#demo form, #demo .form-wrap"), document.querySelector("footer")].filter(Boolean) as Element[]; const seen = new Set<Element>(); const io = new IntersectionObserver((entries) => { entries.forEach((e) => e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)); setHidden(seen.size > 0); }); targets.forEach((t) => io.observe(t)); return () => io.disconnect(); }, []); const href = `https://wa.me/${SITE_CONFIG.contact.whatsapp}?text=${encodeURIComponent(SITE_CONFIG.whatsapp.message)}`; return <a className={hidden ? "whatsapp is-hidden" : "whatsapp"} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined} href={href} target="_blank" rel="noreferrer" aria-label={SITE_CONFIG.whatsapp.label}><MessageCircle /></a>; }
