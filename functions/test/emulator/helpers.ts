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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Empties the database between tests. Triggers from the last test get a moment to finish first. Then,
 * after the clear, its own delete triggers get a moment too: the clear fires one for every document, and
 * one that ran after the next seed would undo it (a teacher's delete clears the phone on the new batch,
 * a student's delete removes the new progress page). On an empty database they change nothing.
 */
export async function freshDatabase(env: { clearFirestore(): Promise<void> }) {
  await sleep(1000);
  await env.clearFirestore();
  await sleep(1500);
}

export const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/**
 * A month of classes paid today. Families are let into their child's batches only while the plan is open
 * (functions/src/billing), so seeds that give a family batch access also give the child a paid plan, written
 * before the student so the student's trigger finds it.
 */
export function paidPlan(studentId: string) {
  return {
    kind: "plan", studentId, studentName: "", title: "1 month of classes", months: 1, amount: 0, discount: 0, payable: 0,
    due: istToday(), payDay: istToday(), status: "paid", method: "free", createdBy: "owner",
  };
}

/**
 * Waits until the triggers have built the seeded children's plans (open). Until then a roster refresh could
 * still find no paid plan and empty the batchAccess the seed wrote, so a test starts only after this.
 */
export async function plansBuilt(ids: string[]) {
  await waitFor(async () => {
    for (const id of ids) {
      const res = await fetch(`http://${firestoreHost}/v1/projects/${PROJECT_ID}/databases/(default)/documents/billing/${id}`, {
        headers: { Authorization: "Bearer owner" },
      });
      if (!res.ok) return undefined;
      const plan = (await res.json()) as { fields?: { open?: { booleanValue?: boolean } } };
      if (plan.fields?.open?.booleanValue !== true) return undefined;
    }
    return true;
  }, 15_000);
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
