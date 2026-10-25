import { useCallback, useEffect, useState, type MouseEvent } from "react";

// The app's menu: each person's own screens (parent, teacher, team), a bar along the bottom on phones and
// a side bar on computers. In the app (app.stoodant.com) every screen has its own address, e.g.
// /parent/progress, so Back and a refresh both work. stoodant.com's old pages keep the screen in memory only,
// since its router knows nothing of these addresses (and in production those pages move to the app anyway).

const IN_APP = import.meta.env.VITE_CONSOLE === "1";

export type Icon = keyof typeof ICONS;
export type NavItem<T extends string> = { key: T; label: string; icon: Icon; badge?: number };
export type Nav<T extends string = string> = {
  items: NavItem<T>[];
  active: T;
  go: (key: T) => void;
  href: (key: T) => string;
};

/**
 * Which screen is open. Old links say `?tab=help` (team notifications) and are mapped with `fromQuery`;
 * the address is then tidied to /admin/help, keeping the rest of the query (?sample=1, ?batch=...).
 */
export function useSection<T extends string>(
  base: string,
  sections: readonly T[],
  fromQuery?: (q: URLSearchParams) => T | null,
): [T, (key: T) => void, (key: T) => string] {
  const home = sections[0]!;
  const href = useCallback(
    (key: T) => {
      const q = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
      q.delete("tab");
      const query = q.toString();
      return `${base}${key === home ? "" : `/${key}`}${query ? `?${query}` : ""}`;
    },
    [base, home],
  );
  const read = useCallback((): T => {
    if (typeof location === "undefined") return home;
    const rest = location.pathname.slice(base.length).replace(/^\/+|\/+$/g, "");
    if (IN_APP && (sections as readonly string[]).includes(rest)) return rest as T;
    return fromQuery?.(new URLSearchParams(location.search)) ?? home;
  }, [base, home, sections, fromQuery]);
  const [section, setSection] = useState<T>(read);

  useEffect(() => {
    if (!IN_APP) return;
    const wanted = href(section);
    if (wanted !== location.pathname + location.search) history.replaceState(null, "", wanted);
    const onPop = () => setSection(read());
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
    // Only once: later moves go through `go`, which updates the address itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback(
    (key: T) => {
      if (IN_APP && key !== section) history.pushState(null, "", href(key));
      setSection(key);
      scrollTo({ top: 0 });
    },
    [href, section],
  );
  return [section, go, href];
}

/** A phone's bottom bar fits five; with more screens, the last place is "More", which lists the rest. */
const BAR = 5;

/** The menu links. Real links, so a long press or middle click opens a screen in a new tab in the app. */
export function NavLinks<T extends string>({ nav }: { nav: Nav<T> }) {
  const [more, setMore] = useState(false);
  const overflow = nav.items.length > BAR;
  const extra = overflow ? nav.items.slice(BAR - 1) : [];
  const extraActive = extra.some((i) => i.key === nav.active);
  const extraBadge = extra.reduce((n, i) => n + (i.badge ?? 0), 0);
  useEffect(() => {
    if (!more) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [more]);
  const open = (e: MouseEvent, key: T) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setMore(false);
    if (key !== nav.active) navigator.vibrate?.(8);
    nav.go(key);
  };
  const link = (item: NavItem<T>, className?: string) => (
    <a
      key={item.key}
      className={className}
      href={IN_APP ? nav.href(item.key) : "#"}
      aria-current={item.key === nav.active ? "page" : undefined}
      onClick={(e) => open(e, item.key)}
    >
      <NavIcon icon={item.icon} badge={item.badge} />
      <span className="pd-nav-label">{item.label}</span>
      {item.badge ? <span className="pd-sr">, {item.badge} new</span> : null}
    </a>
  );
  return (
    <>
      <nav className="pd-nav" aria-label="Menu">
        {/* Computers show every screen in the side bar; phones hide the extra ones behind More. */}
        {nav.items.map((item, i) => link(item, overflow && i >= BAR - 1 ? "pd-nav-extra" : undefined))}
        {overflow && (
          <button
            type="button"
            className="pd-nav-more"
            aria-expanded={more}
            aria-haspopup="true"
            data-active={extraActive || undefined}
            onClick={() => setMore((m) => !m)}
          >
            <NavIcon icon="more" badge={extraBadge} />
            <span className="pd-nav-label">More</span>
          </button>
        )}
      </nav>
      {more && (
        <>
          <button type="button" className="pd-more-backdrop" aria-label="Close menu" onClick={() => setMore(false)} />
          <div className="pd-more-sheet" role="menu">
            {extra.map((item) => link(item))}
          </div>
        </>
      )}
    </>
  );
}

function NavIcon({ icon, badge }: { icon: Icon; badge?: number | undefined }) {
  return (
    <span className="pd-nav-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={ICONS[icon]} />
      </svg>
      {badge ? <span className="pd-nav-badge">{badge > 9 ? "9+" : badge}</span> : null}
    </span>
  );
}

/** A number on a home screen that opens the screen it summarises. */
export function Tile({
  label,
  value,
  hint,
  tone,
  meter,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "alert" | undefined;
  /** 0 to 100: a bar under the number that fills as it counts up. */
  meter?: number | null | undefined;
  onClick: () => void;
}) {
  return (
    <button type="button" className="pd-tile" data-tone={tone} onClick={onClick}>
      <span className="pd-tile-label">{label}</span>
      <strong className="pd-tile-value">
        <CountUp value={value} />
      </strong>
      {meter != null && (
        <span className="pd-meter" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, meter))}%` }} />
        </span>
      )}
      <span className="pd-tile-hint">{hint}</span>
    </button>
  );
}

const calm = () =>
  typeof matchMedia === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Numbers like "86%", "+3" or "12" count up from zero when they first show; anything else as it is. */
export function CountUp({ value }: { value: string }) {
  const match = /^([+-]?)(\d+)(%?)$/.exec(value);
  const target = match ? Number(match[2]) : 0;
  const [shown, setShown] = useState(() => (match && !calm() ? 0 : target));
  useEffect(() => {
    if (!match || calm()) return setShown(target);
    let frame = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setShown(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, value]);
  if (!match) return <>{value}</>;
  return (
    <>
      <span aria-hidden="true">
        {match[1]}
        {shown}
        {match[3]}
      </span>
      <span className="pd-sr">{value}</span>
    </>
  );
}

/**
 * Pull down at the top of a screen to load it again, as in phone apps. Only with touch, and only from the
 * very top, so it never fights normal scrolling. Home screens only: a form elsewhere may hold unsaved taps.
 */
export function usePullToRefresh(onRefresh: (() => void) | null) {
  const [pull, setPull] = useState(0);
  useEffect(() => {
    if (!onRefresh) return;
    let startY: number | null = null;
    let dist = 0;
    const down = (e: TouchEvent) => {
      startY = scrollY <= 0 && e.touches.length === 1 ? e.touches[0]!.clientY : null;
      dist = 0;
    };
    const move = (e: TouchEvent) => {
      if (startY == null) return;
      dist = Math.max(0, e.touches[0]!.clientY - startY);
      setPull(Math.min(dist, 120));
    };
    const up = () => {
      if (startY != null && dist > 90) onRefresh();
      startY = null;
      setPull(0);
    };
    addEventListener("touchstart", down, { passive: true });
    addEventListener("touchmove", move, { passive: true });
    addEventListener("touchend", up);
    return () => {
      removeEventListener("touchstart", down);
      removeEventListener("touchmove", move);
      removeEventListener("touchend", up);
    };
  }, [onRefresh]);
  return pull;
}

// Simple line icons, drawn with a 2px stroke on a 24px grid (styled in dashboard.css).
const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  video: "M3 6h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM16 10l6-3v10l-6-3",
  book: "M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  pen: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  check: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  rupee: "M6 4h12M6 9h12M14 20 7 13h2a4.5 4.5 0 0 0 0-9",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12zM8 10h8M8 14h5",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 17.5h.01",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  layers: "M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z",
  people:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
} as const;
