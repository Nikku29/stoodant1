import { useEffect, useState, type ReactNode } from "react";

import { Logo } from "@/brand/Logo";
import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import "./dashboard.css";

/** The frame every signed-in page shares: logo home link, who this page is for, and log-out. */
export function Shell({
  role,
  onSignOut,
  children,
}: {
  role: string;
  onSignOut?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <div className="pd">
      <header className="pd-top">
        <a href="/" className="pd-logo" aria-label="Stoodant home">
          <Logo variant="full" />
        </a>
        <span className="pd-top-end">
          <span className="pd-role">{role}</span>
          {onSignOut && (
            <button type="button" className="pd-link" onClick={onSignOut}>
              {DASHBOARD_CONFIG.login.signOut}
            </button>
          )}
        </span>
      </header>
      <main className="pd-main">{children}</main>
    </div>
  );
}

/** Shown while Firebase checks whether someone is signed in. */
export function Loading() {
  return (
    <p className="pd-muted" role="status" aria-live="polite">
      Loading…
    </p>
  );
}

/**
 * Whether the address has `?name`. Pages are prerendered without a query, so this is undefined until the
 * page is running in the browser, and the first render matches the prerendered HTML.
 */
export function useSearchFlag(name: string): boolean | undefined {
  const [flag, setFlag] = useState<boolean | undefined>(undefined);
  useEffect(() => setFlag(new URLSearchParams(location.search).has(name)), [name]);
  return flag;
}

/** Sends a signed-out visitor to the log-in page. */
export function RequireLogin() {
  useEffect(() => location.replace("/login"), []);
  return <Loading />;
}
