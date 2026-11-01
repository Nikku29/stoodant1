import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { SCHOLARSHIP_CONFIG } from "@/config/scholarshipConfig";
import { PAGES_META } from "@/config/pagesMeta";
import { Logo } from "@/brand/Logo";
import { CampaignSlide } from "@/components/scholarship/CampaignSlide";
import { UpiQr } from "@/components/UpiQr";
import {
  onlyDigits, onlyLetters, preparePhoto, saveRegistration, savedRegistration, sendPayment, submitScholarship, upiPayLink, type Registered,
  dobRange, isPlausibleDob,
} from "@/lib/scholarship";
import { warmUpLeadForm } from "@/lib/lead";

const copy = SCHOLARSHIP_CONFIG;
const f = copy.form;
const CLASSES = ["9", "10"] as const;
const display = "font-[family-name:var(--font-display)]";

/** /scholarship: the campaign, how the test works, and the registration form. The link to share is stoodant.com/scholarship. */
export function ScholarshipPage() {
  return (
    <div className="min-h-screen bg-white text-[var(--ink)]">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <a href="/" className="logo" aria-label={copy.backHome}><Logo /></a>
          <a href="#register" className="rounded-full bg-[#fbb308] px-4 py-2 text-sm font-extrabold text-[#0a1026]">{f.submit}</a>
        </div>
      </header>
      <main>
        <section className="campaign-banner is-page" aria-label={SITE_CONFIG.scholarship.kicker}>
          <CampaignSlide ctaHref="#register" />
        </section>
        <div className="mx-auto max-w-5xl px-4 pt-10 sm:pt-14">
          <h1 className={`${display} text-3xl font-extrabold leading-tight sm:text-4xl`}>{copy.heading}</h1>
        </div>
        {/* Phones see the form first; wide screens put it beside the details. */}
        <div className="mx-auto grid max-w-5xl gap-12 px-4 pt-8 pb-12 sm:pb-16 lg:grid-cols-[1fr_1.1fr]">
          <div className="min-w-0 lg:order-2"><RegisterForm /></div>
          <div className="min-w-0 lg:order-1">
            <h2 className={`${display} text-xl font-bold sm:text-2xl`}>{copy.stepsHeading}</h2>
            <ol className="mt-4 space-y-4">
              {copy.steps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className={`${display} grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0a1026] text-sm font-bold text-white`}>{i + 1}</span>
                  <span className="leading-7"><strong>{step.title}.</strong> {step.copy}</span>
                </li>
              ))}
            </ol>
            <h2 className={`${display} mt-10 text-xl font-bold sm:text-2xl`}>{copy.detailsHeading}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-neutral-700">
              {copy.details.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <h2 className={`${display} mt-10 text-xl font-bold sm:text-2xl`}>{copy.faqHeading}</h2>
            <div className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
              {copy.faq.map((item) => (
                <details key={item.q} className="py-3">
                  <summary className="cursor-pointer font-semibold">{item.q}</summary>
                  <p className="mt-2 leading-7 text-neutral-700">{item.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-6 text-sm text-neutral-600">
              {copy.help}{" "}
              <a className="font-semibold underline" href={`https://wa.me/${SITE_CONFIG.contact.whatsapp}`}>{SITE_CONFIG.contact.phone}</a>
            </p>
          </div>
        </div>
      </main>
      <footer className="info-footer bg-[var(--ink)] text-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-3 px-4 text-sm" aria-label="Stoodant pages">
          <a href="/">{SITE_CONFIG.brand.name}</a>
          {SITE_CONFIG.footer.pages.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
        <p className="mx-auto mt-4 max-w-5xl px-4 text-xs text-[var(--grey-3)]">© {new Date().getFullYear()} {SITE_CONFIG.brand.name}. {SITE_CONFIG.footer.rights}</p>
      </footer>
    </div>
  );
}

type Errors = { -readonly [K in keyof typeof f.errors]?: string | undefined };

function RegisterForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState<Registered | null>(null);
  const [photo, setPhoto] = useState<{ base64: string; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  // The prerendered form can't be sent until its code has loaded, so it never submits natively.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    setDone(savedRegistration());
  }, []);
  const request = useRef<{ idempotencyKey: string; startedAt: number } | null>(null);
  useEffect(() => { request.current = { idempotencyKey: newKey(), startedAt: Date.now() }; }, []);
  const formRef = useRef<HTMLFormElement>(null);

  const pickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhoto(await preparePhoto(file));
      setErrors((e) => ({ ...e, photo: undefined }));
    } catch {
      setErrors((e) => ({ ...e, photo: f.errors.photoUnreadable }));
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const text = (name: string) => String(values[name] ?? "").trim();
    const isName = (v: string) => v.length >= 2 && onlyLetters(v) === v;
    const next: Errors = {};
    if (!isName(text("studentName"))) next.studentName = f.errors.studentName;
    if (!CLASSES.includes(text("studentClass") as (typeof CLASSES)[number])) next.studentClass = f.errors.studentClass;
    if (!isPlausibleDob(text("dob"))) next.dob = f.errors.dob;
    if (text("school").length < 2) next.school = f.errors.school;
    if (!isName(text("city"))) next.city = f.errors.city;
    if (!/^[1-9]\d{5}$/.test(text("pincode"))) next.pincode = f.errors.pincode;
    if (!isName(text("parentName"))) next.parentName = f.errors.parentName;
    if (!/^[6-9]\d{9}$/.test(text("phone"))) next.phone = f.errors.phone;
    if (!photo) next.photo = errors.photo ?? f.errors.photo;
    if (values["consent"] !== "on") next.consent = f.errors.consent;
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    // Never log form values: they include a child's details and the parent's phone number.
    request.current ??= { idempotencyKey: newKey(), startedAt: Date.now() };
    setPending(true);
    const result = await submitScholarship(
      {
        studentName: text("studentName"), studentClass: text("studentClass"), dob: text("dob"), school: text("school"),
        city: text("city"), pincode: text("pincode"), parentName: text("parentName"), phone: text("phone"), photo: photo!.base64,
      },
      { ...request.current, noticeVersion: f.noticeVersion, website: String(values["website"] ?? "") },
    );
    setPending(false);
    if (result.ok) {
      request.current = null;
      const { ok: _ok, ...registered } = result;
      if (registered.regNo) saveRegistration(registered);
      setDone(registered);
      document.getElementById("register")?.scrollIntoView({ block: "start" });
      return;
    }
    if (result.reason === "phone_taken") {
      setErrors({ phone: f.errors.phoneTaken });
      formRef.current?.querySelector<HTMLElement>("[name='phone']")?.focus();
      return;
    }
    if (result.reason === "invalid" && result.fields?.length) {
      const fromServer: Errors = {};
      for (const field of result.fields) if (field in f.errors) fromServer[field as keyof Errors] = f.errors[field as keyof typeof f.errors];
      setErrors(fromServer);
    }
    setFormError(result.reason === "rate_limited" ? f.errors.rateLimited : result.reason === "invalid" ? f.errors.invalid : f.errors.network);
  };

  const again = () => {
    saveRegistration(null);
    setDone(null);
    setPhoto(null);
    setErrors({});
    request.current = { idempotencyKey: newKey(), startedAt: Date.now() };
  };

  if (done) return <Success done={done} again={again} update={(next) => { saveRegistration(next); setDone(next); }} />;

  const input = "mt-1 block w-full min-h-12 rounded-xl border border-neutral-300 bg-white px-4 text-base outline-none focus:border-[#0a1026] focus:ring-2 focus:ring-[#fbb308] aria-[invalid=true]:border-red-600";
  // Keeps only allowed characters as the parent types (names: letters; phone and PIN: digits).
  const filter = (clean: (v: string) => string) => (e: FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const cleaned = clean(el.value);
    if (cleaned !== el.value) el.value = cleaned;
  };
  const letters = filter(onlyLetters);
  return (
    <section id="register" className="min-w-0 scroll-mt-6 rounded-3xl border border-neutral-200 p-5 shadow-[0_20px_50px_rgba(10,16,38,.08)] sm:p-8">
      <h2 className={`${display} text-2xl font-bold sm:text-3xl`}>{f.heading}</h2>
      <p className="mt-2 text-neutral-600">{f.lead}</p>
      <form ref={formRef} className="mt-6 grid gap-5" onSubmit={submit} onFocus={warmUpLeadForm} onPointerDown={warmUpLeadForm} noValidate aria-busy={pending}>
        <Field label={f.studentName} error={errors.studentName}>
          <input name="studentName" autoComplete="off" maxLength={80} placeholder={f.studentNamePlaceholder} onInput={letters} className={input} aria-invalid={Boolean(errors.studentName)} />
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold">{f.classLabel}</legend>
          <div className="mt-1 grid grid-cols-2 gap-3">
            {CLASSES.map((c) => (
              <label key={c} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-300 font-bold has-[:checked]:border-[#0a1026] has-[:checked]:bg-[#0a1026] has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#fbb308]">
                <input type="radio" name="studentClass" value={c} className="sr-only" aria-invalid={Boolean(errors.studentClass)} />
                Class {c}
              </label>
            ))}
          </div>
          {errors.studentClass && <small role="alert" className="mt-1 block text-sm text-red-700">{errors.studentClass}</small>}
        </fieldset>
        <Field label={f.dob} error={errors.dob} hint={f.dobHint}>
          <input name="dob" type="date" min={dobRange().min} max={dobRange().max} className={input} aria-invalid={Boolean(errors.dob)} />
        </Field>
        <Field label={f.school} error={errors.school}>
          <input name="school" maxLength={120} placeholder={f.schoolPlaceholder} className={input} aria-invalid={Boolean(errors.school)} />
        </Field>
        <div className="grid grid-cols-[1.4fr_1fr] gap-3 sm:gap-5">
          <Field label={f.city} error={errors.city}>
            <input name="city" maxLength={60} autoComplete="address-level2" placeholder={f.cityPlaceholder} onInput={letters} className={input} aria-invalid={Boolean(errors.city)} />
          </Field>
          <Field label={f.pincode} error={errors.pincode}>
            <input name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} pattern="[0-9]{6}" placeholder={f.pincodePlaceholder} onInput={filter((v) => onlyDigits(v, 6))} className={input} aria-invalid={Boolean(errors.pincode)} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={f.parentName} error={errors.parentName}>
            <input name="parentName" maxLength={80} autoComplete="name" onInput={letters} className={input} aria-invalid={Boolean(errors.parentName)} />
          </Field>
          <Field label={f.phone} error={errors.phone} hint={f.phoneHint}>
            <input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder={f.phonePlaceholder} onInput={filter((v) => onlyDigits(v.replace(/^(\+?91|0)(?=\d{10}$)/, ""), 10))} className={input} aria-invalid={Boolean(errors.phone)} />
          </Field>
        </div>
        <div>
          <span className="text-sm font-semibold">{f.photo}</span>
          <div className="mt-1 flex items-center gap-4">
            <div className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-neutral-400 bg-neutral-50">
              {photo ? <img src={photo.preview} alt="" className="h-full w-full object-cover" /> : <svg viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-neutral-400" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="9" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>}
            </div>
            <div className="min-w-0">
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-[#0a1026] px-5 text-sm font-bold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#fbb308]">
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pickPhoto(e)} aria-invalid={Boolean(errors.photo)} />
                {photoBusy ? "…" : photo ? f.photoChange : f.photoChoose}
              </label>
              <p className="mt-2 text-sm leading-5 text-neutral-600">{f.photoHint}</p>
            </div>
          </div>
          {errors.photo && <small role="alert" className="mt-1 block text-sm text-red-700">{errors.photo}</small>}
        </div>
        <label className="flex items-center gap-3 text-sm text-neutral-700">
          <input type="checkbox" name="consent" className="h-5 w-5 shrink-0 accent-[#0a1026]" aria-invalid={Boolean(errors.consent)} />
          <span>{f.consent} <a href="/privacy" className="underline">{f.consentLink}</a> {f.consentAnd} <a href="/terms" className="underline">{f.termsLink}</a>.</span>
        </label>
        {errors.consent && <small role="alert" className="-mt-3 block text-sm text-red-700">{errors.consent}</small>}
        {/* Honeypot: hidden from people and screen readers; bots that fill it are ignored by the server. */}
        <input className="field-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button type="submit" disabled={pending || photoBusy || !hydrated} className="min-h-13 rounded-full bg-[#fbb308] px-6 py-3.5 text-base font-extrabold text-[#0a1026] transition hover:-translate-y-0.5 disabled:opacity-60">
          {pending ? f.submitting : f.submit}
        </button>
        {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</p>}
      </form>
    </section>
  );
}

const fee = (text: string, amount: number) => text.replace("{fee}", String(amount));

function Success({ done, again, update }: { done: Registered; again: () => void; update: (next: Registered) => void }) {
  const s = SCHOLARSHIP_CONFIG.success;
  const link = `${SITE_CONFIG.siteUrl}${PAGES_META.scholarship.path}`;
  const share = `https://wa.me/?text=${encodeURIComponent(`${s.shareText} ${link}`)}`;
  const pay = done.payment;
  const status = SCHOLARSHIP_CONFIG.pay.status[pay.status];
  return (
    <section id="register" className="min-w-0 scroll-mt-6 rounded-3xl bg-[#0a1026] p-6 text-white sm:p-8" role="status" aria-live="polite">
      {/* Printing shows only the slip, so "Save as PDF" gives a clean one-page registration slip. */}
      <style>{"@media print{body *{visibility:hidden!important}body :not(:has(#slip)):not(#slip):not(#slip *){display:none!important}body :has(#slip){margin:0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important}#slip,#slip *{visibility:visible!important;color:#0a1026!important}#slip{background:#fff;border:2px solid #0a1026;border-radius:16px;padding:24px}#slip .slip-muted{color:#555!important}}"}</style>
      <h2 className={`${display} text-2xl font-bold sm:text-3xl`}>{done.existing ? s.existingHeading : s.heading}</h2>
      <div id="slip" className="mt-5 rounded-2xl border border-dashed border-[#fbb308] p-4">
        <p className="slip-muted text-xs font-bold uppercase tracking-[.14em] text-[#fbb308]">{s.slipTitle}</p>
        <p className="slip-muted mt-3 text-xs font-bold uppercase tracking-[.14em] text-[#c9cee0]">{s.numberLabel}</p>
        <p className={`${display} mt-1 select-all text-3xl font-extrabold tracking-wide`}>{done.regNo}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="slip-muted text-[#c9cee0]">{s.slipRows.student}</dt><dd className="font-semibold">{done.studentName}</dd>
          <dt className="slip-muted text-[#c9cee0]">{s.slipRows.class}</dt><dd className="font-semibold">Class {done.studentClass}</dd>
          <dt className="slip-muted text-[#c9cee0]">{s.slipRows.fee}</dt><dd className="font-semibold">₹{pay.amount} · {status}</dd>
        </dl>
      </div>
      <p className="mt-4 leading-7 text-[#c9cee0]">{done.existing ? s.existingLead : s.lead}</p>
      <Payment done={done} update={update} />
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 items-center rounded-full bg-white px-5 font-extrabold text-[#0a1026]">{s.download}</button>
        <a href={share} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center rounded-full bg-[#fbb308] px-5 font-extrabold text-[#0a1026]">{s.share}</a>
        <button type="button" onClick={again} className="min-h-12 rounded-full border border-white/40 px-5 font-bold">{s.another}</button>
      </div>
    </section>
  );
}

function Payment({ done, update }: { done: Registered; update: (next: Registered) => void }) {
  const p = SCHOLARSHIP_CONFIG.pay;
  const pay = done.payment;
  const [utr, setUtr] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  if (pay.status === "paid") return <p className="mt-5 rounded-2xl bg-emerald-500/15 p-4 font-semibold text-emerald-200">✓ {p.paidLead}</p>;
  if (pay.status === "submitted") return <p className="mt-5 rounded-2xl bg-white/10 p-4 leading-7">{p.submittedLead}</p>;
  if (!pay.upi) return <p className="mt-5 rounded-2xl bg-white/10 p-4 leading-7">{fee(p.noUpi, pay.amount)}</p>;
  const upi = pay.upi;
  const link = upiPayLink(upi, pay.amount, done.regNo);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ref = utr.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9]{6,30}$/.test(ref)) return setError(p.errors.utr);
    setSending(true);
    setError("");
    const result = await sendPayment(done.regNo, pay.token, ref);
    setSending(false);
    if ("status" in result) return update({ ...done, payment: { ...pay, status: result.status } });
    setError(result.error === "utr_used" ? p.errors.utrUsed : result.error === "utr" ? p.errors.utr : p.errors.network);
  };

  return (
    <div className="mt-6 rounded-2xl bg-white p-5 text-[#0a1026]">
      <h3 className={`${display} text-xl font-bold`}>{fee(p.heading, pay.amount)}</h3>
      {pay.status === "rejected" && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{p.rejectedLead}</p>}
      <a href={link} className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-[#fbb308] px-5 font-extrabold">{fee(p.openApp, pay.amount)}</a>
      <div className="mt-4 flex items-center gap-4">
        <UpiQr text={link} size={120} label={fee(p.qrLabel, pay.amount)} />
        <div className="min-w-0 text-sm">
          <p className="text-neutral-600">{p.scan}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-semibold">
            <span className="break-all">{upi.upiId}</span>
            <button type="button" className="underline" onClick={() => void navigator.clipboard?.writeText(upi.upiId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>
              {copied ? p.copied : p.copy}
            </button>
          </p>
        </div>
      </div>
      <form className="mt-4" onSubmit={send} noValidate>
        <label className="block">
          <span className="text-sm font-semibold">{p.utrLabel}</span>
          <input value={utr} onChange={(e) => setUtr(e.target.value.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 34))} inputMode="text" autoComplete="off" className="mt-1 block min-h-12 w-full rounded-xl border border-neutral-300 px-4 text-base outline-none focus:border-[#0a1026] focus:ring-2 focus:ring-[#fbb308]" aria-invalid={Boolean(error)} />
          {!error && <small className="mt-1 block text-sm text-neutral-600">{p.utrHint}</small>}
          {error && <small role="alert" className="mt-1 block text-sm text-red-700">{error}</small>}
        </label>
        <button type="submit" disabled={sending || !utr.trim()} className="mt-3 min-h-12 w-full rounded-full bg-[#0a1026] px-5 font-extrabold text-white disabled:opacity-60">{sending ? p.sending : p.send}</button>
      </form>
    </div>
  );
}

function Field({ label, error, hint, children }: { label: string; error: string | undefined; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && !error && <small className="mt-1 block text-sm text-neutral-600">{hint}</small>}
      {error && <small role="alert" className="mt-1 block text-sm text-red-700">{error}</small>}
    </label>
  );
}

function newKey() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))).toString(16));
}
