import { useEffect, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";

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
import { Loading, Shell } from "./Shell";

const copy = DASHBOARD_CONFIG.login;
const home: Record<Role, string> = { admin: "/admin", teacher: "/teacher", parent: "/parent" };
const go = (role: Role) => location.assign(home[role]);

/**
 * One page for everyone. Parents and teachers type their mobile number and the SMS code; the number
 * itself decides which page opens. The team signs in with Google underneath.
 */
export function LoginPage() {
  const session = useSession();
  const [stage, setStage] = useState<"phone" | "code" | "choose" | "missing">("phone");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!firebaseConfigured) {
    return (
      <Shell role={copy.title}>
        <p className="pd-alert">{copy.notConfigured}</p>
      </Shell>
    );
  }

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
      setPending(await sendCode(phone!, "pd-send"));
      setCode("");
      setStage("code");
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
      setStage("phone");
    });

  const signedOut = session === null || stage === "code";
  return (
    <Shell role={copy.title} onSignOut={session && !busy ? () => void restart() : undefined}>
      <section className="pd-child">
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </section>

      {(session === undefined || (session && stage === "phone")) && <Loading />}

      {signedOut && stage === "phone" && (
        <form
          className="pd-card pd-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (phone && !busy) void send();
          }}
        >
          <label className="pd-field" htmlFor="pd-number">
            {copy.phoneLabel}
          </label>
          <div className="pd-phone">
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
              aria-describedby={error ? "pd-login-error" : undefined}
            />
          </div>
          <button id="pd-send" type="submit" className="pd-save" disabled={!phone || busy}>
            {busy ? "Sending…" : copy.sendCode}
          </button>
        </form>
      )}

      {stage === "code" && (
        <form
          className="pd-card pd-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6 && !busy) void verify();
          }}
        >
          <p className="pd-muted">
            {copy.codeSent} <strong>{phone}</strong>
          </p>
          <label className="pd-field">
            {copy.codeLabel}
            <input
              className="pd-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-describedby={error ? "pd-login-error" : undefined}
              autoFocus
            />
          </label>
          <button type="submit" className="pd-save" disabled={code.length !== 6 || busy}>
            {busy ? "Checking…" : copy.verify}
          </button>
          <button type="button" className="pd-link" onClick={() => setStage("phone")}>
            {copy.changeNumber}
          </button>
        </form>
      )}

      {session && stage === "choose" && (
        <div className="pd-card pd-stack">
          <p>{copy.choose}</p>
          <button type="button" className="pd-save" onClick={() => go("parent")}>
            My child's progress
          </button>
          <button type="button" className="pd-ghost" onClick={() => go("teacher")}>
            My batches
          </button>
        </div>
      )}

      {session && stage === "missing" && (
        <div className="pd-card pd-stack">
          <p className="pd-alert">
            {copy.signedInAs} {session.phone}. {copy.notFound}
          </p>
          <a
            className="pd-cta"
            href={`https://wa.me/${SITE_CONFIG.contact.whatsapp}?text=${encodeURIComponent(`Hi Stoodant, I can't log in with ${session.phone}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Message us on WhatsApp
          </a>
          <button type="button" className="pd-link" onClick={restart}>
            {copy.changeNumber}
          </button>
        </div>
      )}

      {error && (
        <p className="pd-alert" id="pd-login-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}

      {signedOut && (
        <section className="pd-card pd-stack" aria-labelledby="pd-team">
          <h2 id="pd-team">{copy.team}</h2>
          <p className="pd-muted">{copy.teamHint}</p>
          <button type="button" className="pd-ghost" onClick={team} disabled={busy}>
            Continue with Google
          </button>
        </section>
      )}
    </Shell>
  );
}
