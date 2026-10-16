import { m } from "framer-motion";
import { ArrowDownRight, Check } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { OfferBadge } from "@/components/sections/shared";

const FinalCtaInfinityRibbon = lazy(() => import("@/components/FinalCtaInfinityRibbon"));

export default function FinalCta() {
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
    // TODO: send the lead to Firestore (step d). Never log form values: they include the parent phone number.
    setSuccess(true);
  };
  const fallbackLoop = <svg className={success ? "cta-loop complete" : "cta-loop"} viewBox="0 0 300 135"><path d="M15 67C45 5 100 5 150 67s105 62 135 0C255 5 200 5 150 67S45 129 15 67Z" /></svg>;
  return <section ref={section} id="demo" className="final-cta section-dark"><div className="container final-grid"><div><span className="eyebrow inverse">{SITE_CONFIG.form.kicker}</span><h2>{SITE_CONFIG.form.headline}</h2>{nearViewport && supportsRibbon ? <Suspense fallback={fallbackLoop}><FinalCtaInfinityRibbon success={success} /></Suspense> : fallbackLoop}</div><div className="form-wrap"><OfferBadge />{success ? <m.div className="success" role="status" aria-live="polite" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}><Check /><h3>{SITE_CONFIG.form.success}</h3></m.div> : <form onSubmit={submit} noValidate><Field label={SITE_CONFIG.form.studentName} error={errors["studentName"]}><input name="studentName" placeholder={SITE_CONFIG.form.studentPlaceholder} maxLength={80} aria-invalid={Boolean(errors["studentName"])} /></Field><div className="form-row"><Field label={SITE_CONFIG.form.classLabel} error={errors["studentClass"]}><select name="studentClass" defaultValue=""><option value="" disabled>{SITE_CONFIG.form.classPlaceholder}</option>{SITE_CONFIG.form.classes.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label={SITE_CONFIG.form.boardLabel} error={errors["board"]}><select name="board" defaultValue=""><option value="" disabled>{SITE_CONFIG.form.boardPlaceholder}</option>{SITE_CONFIG.form.boards.map((item) => <option key={item}>{item}</option>)}</select></Field></div><Field label={SITE_CONFIG.form.phoneLabel} error={errors["phone"]}><input name="phone" type="tel" inputMode="numeric" maxLength={10} placeholder={SITE_CONFIG.form.phonePlaceholder} aria-invalid={Boolean(errors["phone"])} /></Field><button className="button button-light" type="submit">{SITE_CONFIG.form.submit}<ArrowDownRight /></button></form>}</div></div></section>;
}

function Field({ label, error, children }: { label: string; error: string | undefined; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}{error && <small role="alert">{error}</small>}</label>; }
