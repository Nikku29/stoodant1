// The one Firebase app for the browser, shared by App Check (demo form) and the log-in pages.
// Values come from the VITE_FIREBASE_* build variables, which are public by design (DEPLOY.md step 9).
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

const env = (name: string) => import.meta.env[name] as string | undefined;

/** True when the build has a Firebase project to talk to (or the local emulators). */
export const firebaseConfigured =
  Boolean(env("VITE_FIREBASE_APP_ID")) || env("VITE_USE_EMULATORS") === "1";

export function firebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  const projectId = env("VITE_FIREBASE_PROJECT_ID") ?? "demo-stoodant";
  return initializeApp({
    apiKey: env("VITE_FIREBASE_API_KEY") ?? "demo-key",
    projectId,
    appId: env("VITE_FIREBASE_APP_ID") ?? "demo-app",
    // Google sign-in and the phone check run on Firebase's own page for this project.
    authDomain: `${projectId}.firebaseapp.com`,
    // Study material files (teachers upload, parents download) live in the project's default bucket.
    storageBucket: env("VITE_FIREBASE_STORAGE_BUCKET") ?? `${projectId}.firebasestorage.app`,
  });
}
