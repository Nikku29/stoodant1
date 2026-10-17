import { randomUUID } from "node:crypto";

export const PROJECT_ID = "demo-stoodant";
export const ORIGIN = "http://localhost:5173";
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
export const LEAD_URL = `http://${functionsHost}/${PROJECT_ID}/asia-south1/submitLead`;

export async function clearFirestore(): Promise<void> {
  const response = await fetch(`http://${firestoreHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  if (!response.ok) throw new Error(`clear failed: ${response.status}`);
}

export function leadBody(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    parentName: "Anita Sharma",
    studentClass: "7",
    board: "CBSE",
    phone: "9876543210",
    consent: true,
    noticeVersion: "2026-10-17",
    startedAt: Date.now() - 10_000,
    website: "",
    source: { path: "/", utmSource: "google" },
    ...overrides,
  };
}

export function postLead(body: unknown, init: { origin?: string | null; method?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.origin !== null) headers["Origin"] = init.origin ?? ORIGIN;
  return fetch(LEAD_URL, { method: init.method ?? "POST", headers, body: init.method === "GET" ? undefined : JSON.stringify(body) });
}

export async function waitFor<T>(check: () => Promise<T | undefined>, timeoutMs = 10_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const value = await check();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("timed out");
}
