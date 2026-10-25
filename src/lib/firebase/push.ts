// Push notifications for the app (app.stoodant.com): asks the phone's permission, then saves this phone's
// push token under pushDevices/{sha256(token)} with who is signed in, so Cloud Functions can send class
// reminders to a batch's families and alerts to the team. Loaded only by the app, never by stoodant.com.
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore/lite";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

import { firebaseApp } from "./app";
import { firebase, onBeforeSignOut, type Session } from "./session";

const VAPID_KEY = import.meta.env["VITE_FIREBASE_VAPID_KEY"] as string | undefined;
const SAVED = "stoodant-push-device";

export type Platform = "android" | "ios" | "desktop";

export function platform(ua = navigator.userAgent): Platform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** "granted", "denied", "default", or "unsupported" when this browser can't receive push at all. */
export function permission(): NotificationPermission | "unsupported" {
  if (!("Notification" in globalThis) || !("serviceWorker" in navigator) || !("PushManager" in globalThis))
    return "unsupported";
  return Notification.permission;
}

async function sha256(text: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Saves (or refreshes) this phone's token. Call after permission is granted, and on every app open. */
export async function registerDevice(session: Session): Promise<boolean> {
  if (!VAPID_KEY || permission() !== "granted" || !(await isSupported())) return false;
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(firebaseApp()), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) return false;
  const id = await sha256(token);
  await setDoc(doc(firebase().db, "pushDevices", id), {
    uid: session.user.uid,
    phone: session.phone,
    admin: session.admin,
    token,
    platform: platform(),
    updatedAt: serverTimestamp(),
  });
  try {
    localStorage.setItem(SAVED, id);
  } catch {
    // Private mode: the token still works; it just isn't removed on log-out.
  }
  return true;
}

/** Shows the phone's own permission prompt (must run from a tap), then saves the token. */
export async function enableNotifications(session: Session): Promise<NotificationPermission | "unsupported"> {
  if (permission() === "unsupported") return "unsupported";
  const answer = await Notification.requestPermission();
  if (answer === "granted") await registerDevice(session);
  return answer;
}

// A phone that logs out stops getting that person's notifications.
onBeforeSignOut(async () => {
  let id: string | null = null;
  try {
    id = localStorage.getItem(SAVED);
    localStorage.removeItem(SAVED);
  } catch {
    return;
  }
  if (id) await deleteDoc(doc(firebase().db, "pushDevices", id));
});
