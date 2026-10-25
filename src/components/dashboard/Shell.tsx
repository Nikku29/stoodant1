import { useEffect, useState, type ReactNode } from "react";

import { Logo } from "@/brand/Logo";
import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { useSession } from "@/lib/firebase/session";
import { NavLinks, type Nav } from "./AppNav";
import "./dashboard.css";

/**
 * The frame every signed-in page shares: logo home link, who this page is for, and log-out. With `nav`,
 * the person's menu too: along the bottom on phones, down the side on computers.
 */
export function Shell<T extends string = string>({
  role,
  onSignOut,
  nav,
  children,
}: {
  role: string;
  onSignOut?: (() => void) | undefined;
  nav?: Nav<T> | undefined;
  children: ReactNode;
}) {
  return (
    <div className={nav ? "pd pd-has-nav" : "pd"}>
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
      {role && role !== "Team" && <TeamViewBar role={role} />}
      {nav && <NavLinks nav={nav} />}
      <main className="pd-main">{children}</main>
    </div>
  );
}

/**
 * The team can open any teacher's or parent's page from /admin. A bar says so, so nobody mistakes it for
 * their own page or wonders why a teacher's page shows every batch.
 */
function TeamViewBar({ role }: { role: string }) {
  const session = useSession();
  if (!session?.admin) return null;
  return (
    <p className="pd-viewas" role="status">
      <span>{DASHBOARD_CONFIG.login.teamView.replace("{role}", role.toLowerCase())}</span>
      <a href="/admin">{DASHBOARD_CONFIG.login.backToTeam}</a>
    </p>
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
