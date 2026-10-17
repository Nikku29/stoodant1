// Sends the demo request to the submitLead Cloud Function. No Firebase SDK is needed for this call;
// only App Check (loaded on first touch of the form) adds a token header.

export type LeadFields = { parentName: string; studentClass: string; board: string; phone: string };
export type LeadResult = { ok: true } | { ok: false; reason: "invalid" | "rate_limited" | "network" };

const ENDPOINT = (import.meta.env["VITE_LEAD_ENDPOINT"] as string | undefined) ?? "/api/lead";
const ATTEMPTS = 3;

let appCheckModule: Promise<typeof import("./appCheck")> | null = null;

/** Starts loading App Check in the background. Call on the first focus or tap inside the form. */
export function warmUpLeadForm() {
  appCheckModule ??= import("./appCheck");
}

/** Marketing source of this visit (path and UTM tags only; never anything personal). */
function visitSource() {
  const params = new URLSearchParams(location.search);
  const tag = (name: string) => params.get(name)?.slice(0, 100) || undefined;
  return { path: location.pathname, utmSource: tag("utm_source"), utmMedium: tag("utm_medium"), utmCampaign: tag("utm_campaign") };
}

/**
 * POSTs one request. Network errors and 5xx are retried with exponential backoff and full jitter,
 * reusing the same idempotency key, so a retry can never create a second lead.
 */
export async function submitLead(fields: LeadFields, meta: { idempotencyKey: string; startedAt: number; noticeVersion: string; website: string }): Promise<LeadResult> {
  warmUpLeadForm();
  let token: string | null = null;
  try {
    token = await (await appCheckModule!).getAppCheckToken();
  } catch {
    // App Check failing to load must not block the parent; the server decides whether a token is required.
  }
  const body = JSON.stringify({ ...fields, ...meta, consent: true, source: visitSource() });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Firebase-AppCheck"] = token;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const response = await fetch(ENDPOINT, { method: "POST", headers, body });
      if (response.ok) return { ok: true };
      if (response.status === 429) return { ok: false, reason: "rate_limited" };
      if (response.status < 500) return { ok: false, reason: "invalid" };
    } catch {
      // Network error: fall through to retry.
    }
    if (attempt < ATTEMPTS - 1) await new Promise((resolve) => setTimeout(resolve, Math.random() * 400 * 2 ** attempt));
  }
  return { ok: false, reason: "network" };
}
