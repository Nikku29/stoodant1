// Loaded on the parent's first touch of the demo form, never at page load (CLAUDE.md performance rules).
// Without VITE_RECAPTCHA_SITE_KEY (local dev, emulator) App Check is skipped and the function must not enforce it.
import { initializeApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";

let appCheck: AppCheck | null | undefined;

function setup(): AppCheck | null {
  const siteKey = import.meta.env["VITE_RECAPTCHA_SITE_KEY"] as string | undefined;
  const appId = import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined;
  if (!siteKey || !appId) return null;
  const app = initializeApp({
    apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] as string,
    projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string,
    appId,
  });
  return initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: false });
}

/** An App Check token for the lead request, or null when App Check is not configured. */
export async function getAppCheckToken(): Promise<string | null> {
  if (appCheck === undefined) appCheck = setup();
  if (!appCheck) return null;
  return (await getToken(appCheck, false)).token;
}
