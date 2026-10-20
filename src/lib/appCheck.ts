// Loaded on the parent's first touch of the demo form, never at page load (CLAUDE.md performance rules),
// and by the log-in pages. Without VITE_RECAPTCHA_SITE_KEY (local dev, emulator) App Check is skipped and
// the backend must not enforce it.
import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";
import { firebaseApp } from "./firebase/app";

let appCheck: AppCheck | null | undefined;

/** Starts App Check once; later Firebase calls (Auth, Firestore, Functions) then carry its token. */
export function ensureAppCheck(): AppCheck | null {
  if (appCheck !== undefined) return appCheck;
  const siteKey = import.meta.env["VITE_RECAPTCHA_SITE_KEY"] as string | undefined;
  const appId = import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined;
  appCheck =
    siteKey && appId
      ? initializeAppCheck(firebaseApp(), {
          provider: new ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: false,
        })
      : null;
  return appCheck;
}

/** An App Check token for the lead request, or null when App Check is not configured. */
export async function getAppCheckToken(): Promise<string | null> {
  const instance = ensureAppCheck();
  if (!instance) return null;
  return (await getToken(instance, false)).token;
}
