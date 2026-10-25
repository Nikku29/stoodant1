// Sign-in and data access for /login, /parent, /teacher and /admin. Only those route chunks import this
// file, so none of the Auth or Firestore code loads with the landing page.
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  type Auth,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore/lite";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";

import { ensureAppCheck } from "@/lib/appCheck";
import { firebaseApp } from "./app";

const REGION = "asia-south1";
const useEmulators = import.meta.env["VITE_USE_EMULATORS"] === "1";

let services:
  | {
      auth: Auth;
      db: Firestore;
      claimAdmin: () => Promise<unknown>;
      call: <T>(name: string, data: unknown) => Promise<T>;
    }
  | undefined;

export function firebase() {
  if (services) return services;
  const app = firebaseApp();
  ensureAppCheck();
  const auth = getAuth(app);
  auth.languageCode = "en";
  const db = getFirestore(app);
  const functions = getFunctions(app, REGION);
  if (useEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  const claim = httpsCallable(functions, "claimAdmin");
  const call = async <T>(name: string, data: unknown) =>
    (await httpsCallable<unknown, T>(functions, name)(data)).data;
  services = { auth, db, claimAdmin: () => claim(), call };
  return services;
}

export type Role = "admin" | "teacher" | "parent";
export type Session = { user: User; phone: string; admin: boolean };

/** The signed-in person, or null once we know nobody is; undefined while Firebase is still checking. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const { auth } = firebase();
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return setSession(null);
      const token = await user.getIdTokenResult();
      setSession({ user, phone: user.phoneNumber ?? "", admin: token.claims["admin"] === true });
    });
  }, []);
  return session;
}

/** 10-digit Indian mobile number → +91 form, or null when it isn't one. */
export function indianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/**
 * Sends the 6-digit code by SMS. The robot check stays invisible and lives in a fresh element inside
 * `holderId` for every send, so "Resend code" works as often as Firebase allows.
 */
export async function sendCode(phone: string, holderId: string): Promise<ConfirmationResult> {
  const { auth } = firebase();
  const holder = document.getElementById(holderId)!;
  holder.replaceChildren();
  const slot = holder.appendChild(document.createElement("div"));
  const verifier = new RecaptchaVerifier(auth, slot, { size: "invisible" });
  try {
    return await signInWithPhoneNumber(auth, phone, verifier);
  } finally {
    verifier.clear();
  }
}

/** Google sign-in for the Stoodant team. Resolves true when the account is on the team list. */
export async function signInTeam(): Promise<boolean> {
  const { auth, claimAdmin } = firebase();
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  try {
    await claimAdmin();
  } catch {
    await signOut(auth);
    return false;
  }
  await result.user.getIdToken(true);
  return true;
}

// Work to finish while still signed in, such as forgetting this phone for push notifications.
const beforeSignOut = new Set<() => Promise<void>>();
export function onBeforeSignOut(task: () => Promise<void>) {
  beforeSignOut.add(task);
}

export async function signOutNow() {
  await Promise.all([...beforeSignOut].map((task) => task().catch(() => undefined)));
  await signOut(firebase().auth);
}

/** Plain words for the errors people actually hit. */
export function authMessage(error: unknown): string {
  const code = (error as { code?: string }).code ?? "";
  if (code.includes("invalid-verification-code"))
    return "That code doesn't match. Please check the SMS and try again.";
  if (code.includes("code-expired")) return "That code has expired. Please ask for a new one.";
  if (code.includes("too-many-requests"))
    return "Too many tries from this phone. Please wait a little and try again.";
  if (code.includes("quota-exceeded"))
    return "We can't send more codes right now. Please try again in a few hours, or message us on WhatsApp.";
  if (code.includes("captcha") || code.includes("app-not-authorized"))
    return "We couldn't confirm this browser. Please refresh the page and try again.";
  if (code.includes("invalid-phone-number")) return "Please enter a 10-digit mobile number.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup"))
    return "Sign-in was closed before it finished.";
  if (code.includes("popup-blocked"))
    return "Your browser blocked the sign-in window. Please allow pop-ups and try again.";
  if (code.includes("network")) return "No internet connection. Please check and try again.";
  return "Something went wrong. Please try again, or message us on WhatsApp.";
}
