import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { enableNotifications, permission, registerDevice } from "@/lib/firebase/push";
import type { Session } from "@/lib/firebase/session";
import { browserKind, canPrompt, isInstalled, onInstallChange, promptInstall } from "./install";
import "./setup.css";

const SEEN = "stoodant-setup-seen";
const seen = () => {
  try {
    return localStorage.getItem(SEEN) === "1";
  } catch {
    return false;
  }
};
/** The header keeps a slot for the setup icon (see Shell), so it never covers the menu or the page. */
const SLOT = "pd-setup-slot";
function useSlot() {
  const [slot, setSlot] = useState<HTMLElement | null>(() => document.getElementById(SLOT));
  useEffect(() => {
    const find = () => setSlot(document.getElementById(SLOT));
    const watch = new MutationObserver(find);
    watch.observe(document.body, { childList: true, subtree: true });
    find();
    return () => watch.disconnect();
  }, []);
  return slot;
}

/**
 * After log-in: install the app, then allow notifications, so class reminders reach the phone. The steps
 * open by themselves only the first time on each phone; after that a small bell in the header opens them,
 * until both are done. They close with Not now, the cross, Escape or a tap outside, so they never block
 * the page. iPhones only allow notifications once the app is on the home screen.
 * In practice mode (`?sample=1&setup=1`) it shows with nobody signed in, for demos and tests.
 */
export function Setup({ session }: { session: Session | null }) {
  const promptReady = useSyncExternalStore(onInstallChange, canPrompt, () => false);
  const [installed, setInstalled] = useState(isInstalled);
  const [allowed, setAllowed] = useState(permission);
  const [open, setOpen] = useState(() => !seen());
  const slot = useSlot();
  const [busy, setBusy] = useState(false);
  const kind = browserKind();

  // Keep this phone's token fresh on every open, so reminders keep arriving after the browser renews it.
  useEffect(() => {
    if (session && permission() === "granted") void registerDevice(session).catch(() => undefined);
  }, [session]);
  useEffect(() => onInstallChange(() => setInstalled(isInstalled())), []);

  const installPossible = kind !== "desktop" || promptReady;
  const needInstall = !installed && installPossible;
  const needNotify = allowed !== "granted" && !(allowed === "unsupported" && kind === "desktop");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);
  if (!needInstall && !needNotify) return null;

  const hide = () => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      // Private mode: it opens again next time.
    }
    setOpen(false);
  };
  const install = async () => {
    setBusy(true);
    if (await promptInstall()) setInstalled(true);
    setBusy(false);
  };
  const notify = async () => {
    setBusy(true);
    // Practice mode (no one signed in) still shows the phone's prompt, but saves nothing.
    const ask = session ? enableNotifications(session) : Notification.requestPermission();
    setAllowed(await ask.catch(() => permission()));
    setBusy(false);
  };

  if (!open)
    return slot
      ? createPortal(
          <button
            type="button"
            className="st-bell"
            onClick={() => setOpen(true)}
            aria-label="Finish setup: install the app and get class reminders"
            title="Install the app and get class reminders"
          >
            <Bell />
            <span className="st-dot" aria-hidden="true" />
          </button>,
          slot,
        )
      : null;

  const iosWaiting = kind.startsWith("ios") && !installed;
  return (
    <div className="st-backdrop" onClick={(e) => e.target === e.currentTarget && hide()}>
      <section className="st-sheet" role="dialog" aria-modal="true" aria-labelledby="st-title">
        <button type="button" className="st-close" onClick={hide} aria-label="Close">
          ×
        </button>
        <h2 id="st-title">Set up the Stoodant app</h2>
        <p className="st-lead">Two quick steps so you never miss a class.</p>

        <Step n={1} done={installed} title="Add Stoodant to your home screen">
          {installed ? (
            <p>Done. Open Stoodant from its icon from now on.</p>
          ) : promptReady ? (
            <>
              <p>It opens like an app, straight to your page.</p>
              <button type="button" className="st-btn" onClick={install} disabled={busy}>
                Install app
              </button>
            </>
          ) : (
            <InstallHelp kind={kind} />
          )}
        </Step>

        <Step n={2} done={allowed === "granted"} title="Turn on notifications">
          {allowed === "granted" ? (
            <p>Done. You'll get class reminders and important updates.</p>
          ) : iosWaiting ? (
            <p>On iPhone this works once Stoodant is on your home screen. Open it from there and tap this again.</p>
          ) : allowed === "denied" ? (
            <p>
              Notifications are blocked for this app. Open the phone's <b>Settings</b>, then{" "}
              <b>Notifications</b> (or the browser's site settings), and allow them for Stoodant.
            </p>
          ) : allowed === "unsupported" ? (
            <p>This browser can't show notifications. Please open Stoodant in Chrome or Safari.</p>
          ) : (
            <>
              <p>Get a reminder 5 minutes before each class, and updates from the teacher.</p>
              <button type="button" className="st-btn" onClick={notify} disabled={busy}>
                Turn on notifications
              </button>
            </>
          )}
        </Step>

        <button type="button" className="st-skip" onClick={hide}>
          Not now
        </button>
        <p className="st-note">You can do this any time from the bell at the top.</p>
      </section>
    </div>
  );
}

function Step({
  n,
  done,
  title,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="st-step" data-done={done || undefined}>
      <span className="st-num" aria-hidden="true">
        {done ? "✓" : n}
      </span>
      <div>
        <h3>
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h3>
        {children}
      </div>
    </div>
  );
}

function InstallHelp({ kind }: { kind: ReturnType<typeof browserKind> }) {
  if (kind === "ios-safari")
    return (
      <ol className="st-how">
        <li>
          Tap <b>Share</b> <ShareIcon /> at the bottom of Safari.
        </li>
        <li>
          Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
        </li>
        <li>Open Stoodant from your home screen.</li>
      </ol>
    );
  if (kind === "ios-other")
    return <p>Open this page in <b>Safari</b>, tap Share, then Add to Home Screen.</p>;
  if (kind === "in-app")
    return (
      <p>
        This page is open inside another app. Tap <b>⋮</b> or <b>···</b> and choose{" "}
        <b>Open in Chrome</b> (Android) or <b>Open in Safari</b> (iPhone).
      </p>
    );
  return (
    <p>
      Open the browser menu <b>⋮</b> and tap <b>Install app</b> or <b>Add to Home screen</b>.
    </p>
  );
}

const ShareIcon = () => (
  <svg className="st-icon" viewBox="0 0 24 24" aria-label="the square with an arrow" role="img">
    <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const Bell = () => (
  <svg className="st-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);
