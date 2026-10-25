import { useEffect, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";

import { AntSprite, AntUse } from "@/brand/Ant";
import { Logo } from "@/brand/Logo";
import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { SITE_CONFIG } from "@/config/siteConfig";
import { firebaseConfigured } from "@/lib/firebase/app";
import { rolesFor } from "@/lib/firebase/school";
import {
  authMessage,
  indianMobile,
  sendCode,
  signInTeam,
  signOutNow,
  useSession,
  type Role,
} from "@/lib/firebase/session";
import "./dashboard.css";
import { useMoveToApp } from "@/lib/moveToApp";

const copy = DASHBOARD_CONFIG.login;
const home: Record<Role, string> = { admin: "/admin", teacher: "/teacher", parent: "/parent" };
const go = (role: Role) => location.assign(home[role]);
const RESEND_AFTER = 30;
// In the app (app.stoodant.com) "back home" is the website; on stoodant.com it is this site's own home.
const SITE_HOME = import.meta.env["VITE_CONSOLE"] === "1" ? SITE_CONFIG.siteUrl : "/";
const help = (text: string) =>
  `https://wa.me/${SITE_CONFIG.contact.whatsapp}?text=${encodeURIComponent(text)}`;

type Stage = "phone" | "code" | "choose" | "missing";

/**
 * One page for everyone. Parents and teachers type their mobile number and the SMS code; the number
 * itself decides which page opens. The team signs in with Google at the bottom.
 */
export function LoginPage() {
  useMoveToApp();
  const session = useSession();
  const [stage, setStage] = useState<Stage>("phone");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  // Someone already signed in goes straight to their page.
  useEffect(() => {
    if (!session || busy) return;
    if (session.admin) return go("admin");
    if (!session.phone) {
      // A Google account that isn't on the team list has no page here.
      setError(copy.teamDenied);
      void signOutNow();
      return;
    }
    void rolesFor(session.phone).then(({ teacher, parent }) => {
      if (teacher && parent) setStage("choose");
      else if (teacher) go("teacher");
      else if (parent) go("parent");
      else setStage("missing");
    });
  }, [session, busy]);

  // Counts down to "Resend code".
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const phone = indianMobile(number);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      setPending(await sendCode(phone!, "pd-robot-check"));
      setCode("");
      setStage("code");
      setWait(RESEND_AFTER);
    });
  const verify = () =>
    run(async () => {
      await pending!.confirm(code);
      setStage("phone");
    });
  const team = () =>
    run(async () => {
      if (await signInTeam()) go("admin");
      else setError(copy.teamDenied);
    });
  const restart = () =>
    run(async () => {
      await signOutNow();
      setNumber("");
      setStage("phone");
    });

  const signedOut = session === null || stage === "code";
  const checking = firebaseConfigured && (session === undefined || (session && stage === "phone"));

  let body;
  if (!firebaseConfigured) body = <p className="pd-alert">{copy.notConfigured}</p>;
  else if (checking)
    body = (
      <p className="lg-checking" role="status">
        Checking…
      </p>
    );
  else if (signedOut && stage === "phone")
    body = (
      <form
        className="pd-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (phone && !busy) void send();
        }}
      >
        <Steps at={1} />
        <label className="lg-label" htmlFor="pd-number">
          {copy.phoneLabel}
        </label>
        <div className="pd-phone lg-phone">
          <span aria-hidden="true">+91</span>
          <input
            id="pd-number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={14}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="98765 43210"
            aria-describedby={error ? "pd-login-error" : "pd-number-hint"}
            autoFocus
          />
        </div>
        <p className="lg-hint" id="pd-number-hint">
          {copy.phoneHint}
        </p>
        <button type="submit" className="pd-save lg-primary" disabled={!phone || busy}>
          {busy ? "Sending…" : copy.sendCode}
        </button>
      </form>
    );
  else if (stage === "code")
    body = (
      <form
        className="pd-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6 && !busy) void verify();
        }}
      >
        <Steps at={2} />
        <p className="lg-sent">
          {copy.codeSent}{" "}
          <strong>
            +91 {phone!.slice(3, 8)} {phone!.slice(8)}
          </strong>
        </p>
        <label className="lg-label" htmlFor="pd-code">
          {copy.codeLabel}
        </label>
        <input
          id="pd-code"
          className="lg-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          placeholder="••••••"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          aria-describedby={error ? "pd-login-error" : undefined}
          autoFocus
        />
        <button type="submit" className="pd-save lg-primary" disabled={code.length !== 6 || busy}>
          {busy ? "Checking…" : copy.verify}
        </button>
        <div className="lg-row">
          <button type="button" className="pd-link" onClick={() => setStage("phone")}>
            {copy.changeNumber}
          </button>
          {wait > 0 ? (
            <span className="lg-hint" aria-live="polite">
              {copy.resendIn} {wait}s
            </span>
          ) : (
            <button type="button" className="pd-link" disabled={busy} onClick={() => void send()}>
              {copy.resend}
            </button>
          )}
        </div>
      </form>
    );
  else if (session && stage === "choose")
    body = (
      <div className="pd-stack">
        <p>{copy.choose}</p>
        <button type="button" className="pd-save lg-primary" onClick={() => go("parent")}>
          My child's progress
        </button>
        <button type="button" className="pd-ghost" onClick={() => go("teacher")}>
          My batches
        </button>
      </div>
    );
  else if (session && stage === "missing")
    body = (
      <div className="pd-stack">
        <p className="pd-alert">
          {copy.signedInAs} {session.phone}. {copy.notFound}
        </p>
        <a
          className="pd-cta"
          href={help(`Hi Stoodant, I can't log in with ${session.phone}.`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Message us on WhatsApp
        </a>
        <button type="button" className="pd-link" onClick={() => void restart()}>
          {copy.changeNumber}
        </button>
      </div>
    );

  return (
    <div className="lg">
      <AntSprite />
      <aside className="lg-brand">
        <a href={SITE_HOME} className="lg-logo" aria-label="Stoodant home">
          <Logo variant="full" tone="dark" />
        </a>
        <div className="lg-pitch">
          <h1>{copy.welcome}</h1>
          <p>{copy.pitch}</p>
          <ul className="lg-points">
            {copy.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <svg className="lg-ant" viewBox="0 0 120 120" aria-hidden="true">
          <ellipse cx="60" cy="112" rx="34" ry="5" className="lg-ant-shadow" />
          <AntUse cx={60} base={112} h={104} pose="wave" />
        </svg>
      </aside>

      <main className="lg-panel">
        <a href={SITE_HOME} className="lg-back">
          ← {copy.backHome}
        </a>
        <div className="lg-card">
          <h2 className="lg-title">{copy.title}</h2>
          <p className="lg-intro">{copy.intro}</p>
          {body}
          {error && (
            <p className="pd-alert" id="pd-login-error" role="alert">
              {error}
            </p>
          )}
          <p className="lg-help">
            {copy.trouble}{" "}
            <a
              href={help("Hi Stoodant, I need help logging in.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy.troubleLink}
            </a>
          </p>
        </div>

        {firebaseConfigured && signedOut && (
          <div className="lg-team">
            <span>{copy.team}</span>
            <button type="button" className="lg-google" onClick={() => void team()} disabled={busy}>
              <GoogleMark />
              Continue with Google
            </button>
          </div>
        )}
        {session && !busy && stage !== "code" && (
          <button type="button" className="pd-link lg-signout" onClick={() => void restart()}>
            {DASHBOARD_CONFIG.login.signOut}
          </button>
        )}
        {/* The invisible robot check for SMS codes renders here. */}
        <div id="pd-robot-check" />
      </main>
    </div>
  );
}

function Steps({ at }: { at: 1 | 2 }) {
  return (
    <ol className="lg-steps" aria-label={`Step ${at} of 2`}>
      {[copy.stepNumber, copy.stepCode].map((label, i) => (
        <li key={label} className={i + 1 === at ? "is-on" : i + 1 < at ? "is-done" : ""}>
          <span>{i + 1 < at ? "✓" : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.8c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.7 10.8l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
