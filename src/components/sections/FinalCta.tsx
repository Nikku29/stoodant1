import { m } from "framer-motion";
import { ArrowDownRight } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { OfferBadge } from "@/components/sections/shared";
import { submitLead, warmUpLeadForm } from "@/lib/lead";
import { TIMING } from "@/config/timing";
import { Logo } from "@/brand/Logo";
import { AntFlagScene } from "@/brand/AntFlagScene";
import { Highlight } from "@/brand/Highlight";

export default function FinalCta() {
  const [success, setSuccess] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false); const [formError, setFormError] = useState("");
  // One idempotency key per filled-in form: retries of the same submit reuse it, so they never create a second lead.
  const request = useRef<{ idempotencyKey: string; startedAt: number } | null>(null);
  useEffect(() => { request.current = { idempotencyKey: newKey(), startedAt: Date.now() }; }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (pending) return; const data = new FormData(event.currentTarget); const values = Object.fromEntries(data); const next: Record<string, string> = {};
    if (String(values["parentName"] ?? "").trim().length < 2) next["parentName"] = SITE_CONFIG.form.errors.name;
    if (!values["studentClass"]) next["studentClass"] = SITE_CONFIG.form.errors.className;
    if (!values["board"]) next["board"] = SITE_CONFIG.form.errors.board;
    if (!/^[6-9]\d{9}$/.test(String(values["phone"] ?? ""))) next["phone"] = SITE_CONFIG.form.errors.phone;
    if (values["consent"] !== "on") next["consent"] = SITE_CONFIG.form.errors.consent;
    setErrors(next); setFormError(""); if (Object.keys(next).length) return;
    // Never log form values: they include the parent's phone number.
    request.current ??= { idempotencyKey: newKey(), startedAt: Date.now() };
    setPending(true);
    const result = await submitLead(
      { parentName: String(values["parentName"]).trim(), studentClass: String(values["studentClass"]), board: String(values["board"]), phone: String(values["phone"]) },
      { ...request.current, noticeVersion: SITE_CONFIG.form.noticeVersion, website: String(values["website"] ?? "") },
    );
    setPending(false);
    if (result.ok) { request.current = null; setSuccess(true); return; }
    setFormError(result.reason === "rate_limited" ? SITE_CONFIG.form.errors.rateLimited : SITE_CONFIG.form.errors.network);
  };
  return <section id="demo" className="final-cta section-dark"><div className="container final-grid"><div><span className="eyebrow inverse">{SITE_CONFIG.form.kicker}</span><h2><Highlight text={SITE_CONFIG.form.headline} phrase={SITE_CONFIG.form.highlight} tone="dark" delay={TIMING.highlight.ctaDelay} /></h2><AntFlagScene success={success} /></div><div className="form-wrap"><OfferBadge />{success ? <m.div className="success" role="status" aria-live="polite" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}><Logo variant="mark" tone="dark" animate="blink" /><h3>{SITE_CONFIG.form.success}</h3></m.div> : <form onSubmit={submit} onFocus={warmUpLeadForm} onPointerDown={warmUpLeadForm} noValidate aria-busy={pending}><Field label={SITE_CONFIG.form.parentName} error={errors["parentName"]}><input name="parentName" autoComplete="name" placeholder={SITE_CONFIG.form.parentPlaceholder} maxLength={80} aria-invalid={Boolean(errors["parentName"])} /></Field><div className="form-row"><Field label={SITE_CONFIG.form.classLabel} error={errors["studentClass"]}><select name="studentClass" defaultValue=""><option value="" disabled>{SITE_CONFIG.form.classPlaceholder}</option>{SITE_CONFIG.form.classes.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label={SITE_CONFIG.form.boardLabel} error={errors["board"]}><select name="board" defaultValue=""><option value="" disabled>{SITE_CONFIG.form.boardPlaceholder}</option>{SITE_CONFIG.form.boards.map((item) => <option key={item}>{item}</option>)}</select></Field></div><Field label={SITE_CONFIG.form.phoneLabel} error={errors["phone"]}><input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder={SITE_CONFIG.form.phonePlaceholder} aria-invalid={Boolean(errors["phone"])} /></Field><label className="field-consent"><input type="checkbox" name="consent" aria-invalid={Boolean(errors["consent"])} /><span>{SITE_CONFIG.form.consent}</span></label>{errors["consent"] && <small className="field-consent-error" role="alert">{errors["consent"]}</small>}{/* Honeypot: hidden from people and screen readers; bots that fill it are ignored by the server. */}<input className="field-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" /><button className="button button-light" type="submit" disabled={pending}>{pending ? SITE_CONFIG.form.submitting : SITE_CONFIG.form.submit}<ArrowDownRight /></button>{formError && <p className="form-error" role="alert">{formError}</p>}</form>}</div></div></section>;
}

function Field({ label, error, children }: { label: string; error: string | undefined; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}{error && <small role="alert">{error}</small>}</label>; }

function newKey() { return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))).toString(16)); }
