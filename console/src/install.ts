// Installing the app. Chrome and Edge offer their own install prompt through `beforeinstallprompt`, which
// fires early, so it is caught here at start-up and kept until the person taps Install. Safari on iPhone
// has no prompt: people use Share, then Add to Home Screen, and the app shows them how.
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

export function watchInstall() {
  addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    changed();
  });
  addEventListener("appinstalled", () => {
    deferred = null;
    changed();
  });
}

export function onInstallChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Opened from the home screen icon (or already installed and running as an app). */
export function isInstalled() {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const canPrompt = () => deferred !== null;

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  changed();
  return outcome === "accepted";
}

export type Browser = "ios-safari" | "ios-other" | "in-app" | "android" | "desktop";

/** Which install help to show. In-app browsers (Instagram, Facebook, WhatsApp's own viewer) can't install. */
export function browserKind(ua = navigator.userAgent): Browser {
  if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|; wv\)|WhatsApp/i.test(ua)) return "in-app";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS/.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}
