import { useEffect, useState, type ReactNode } from "react";

import { Logo } from "@/brand/Logo";
import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { useSession } from "@/lib/firebase/session";
import { NavLinks, usePullToRefresh, type Nav } from "./AppNav";
import "./dashboard.css";

// The website's home page: its full address on the app (app.stoodant.com), "/" on the website itself.
const SITE_HOME = import.meta.env.VITE_CONSOLE === "1" ? "https://stoodant.com/" : "/";

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
  const pull = usePullToRefresh(nav && nav.active === nav.items[0]?.key ? reload : null);
  return (
    <div className={nav ? "pd pd-has-nav" : "pd"}>
      {pull > 0 && (
        <div className="pd-pull" style={{ height: pull * 0.6 }} aria-hidden="true">
          <span className={pull > 90 ? "pd-pull-dot is-ready" : "pd-pull-dot"} style={{ transform: `rotate(${pull * 3}deg)` }} />
        </div>
      )}
      <header className="pd-top">
        {/* The website's home page (stoodant.com), also from the app's own address. */}
        <a href={SITE_HOME} className="pd-logo" aria-label="Stoodant home">
          <Logo variant="full" />
        </a>
        <span className="pd-top-end">
          {/* The app's setup bell goes here (console/src/Setup.tsx), out of the way of the page. */}
          <span id="pd-setup-slot" className="pd-setup-slot" />
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
      {/* A new key per screen replays the entrance, so moving between screens feels like an app. */}
      <main className="pd-main" key={nav?.active}>
        {children}
      </main>
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

const reload = () => location.reload();

/** Shown while a screen loads: grey shapes where the content will be, which reads as faster than text. */
export function Loading() {
  return (
    <div className="pd-skeleton" role="status" aria-live="polite">
      <span className="pd-sr">Loading…</span>
      <span className="pd-skel pd-skel-title" />
      <span className="pd-skel pd-skel-line" />
      <span className="pd-skel-row">
        <span className="pd-skel pd-skel-tile" />
        <span className="pd-skel pd-skel-tile" />
      </span>
      <span className="pd-skel pd-skel-card" />
    </div>
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
