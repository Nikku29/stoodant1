import { logger } from "firebase-functions";
import {
  EMAIL_API_KEY, EMAIL_FROM, OWNER_EMAIL_TO, OWNER_WHATSAPP_TO, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE,
  WHATSAPP_TOKEN,
} from "../config.js";
import { withRetry } from "../lib/retry.js";
import { pushToTeam, type Push } from "./push.js";

// Alerts to the Stoodant team: email (Resend), push to every team phone with the app, and WhatsApp once a
// sender number is set up. Each channel retries on its own and never blocks the others; the caller records
// the outcome per channel so it is visible in the console.

export type AlertStatus = "sent" | "failed" | "skipped";
export type TeamAlert = {
  /** Same key = the email is sent once, even when the trigger runs twice. */
  key: string;
  subject: string;
  lines: string[];
  push: Push;
  /** Approved WhatsApp template and its body variables; left out = no WhatsApp for this alert. */
  whatsapp?: { template: string; params: string[] };
};

const DISABLED = new Set(["", "disabled"]);
const list = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

export async function alertTeam(alert: TeamAlert): Promise<Record<"email" | "push" | "whatsapp", AlertStatus>> {
  const [email, push, whatsapp] = await Promise.all([
    deliver("email", () => sendEmail(alert)),
    deliver("push", async () => (await pushToTeam(alert.push)) > 0),
    deliver("whatsapp", () => sendWhatsApp(alert)),
  ]);
  return { email, push, whatsapp };
}

async function deliver(channel: string, send: () => Promise<boolean>): Promise<AlertStatus> {
  try {
    return (await withRetry(send)) ? "sent" : "skipped";
  } catch (error) {
    logger.error("team_alert_failed", { channel, message: error instanceof Error ? error.message : "unknown" });
    return "failed";
  }
}

/** Resend's REST API (https://resend.com/docs/api-reference/emails/send-email). Returns false when switched off. */
async function sendEmail(alert: TeamAlert): Promise<boolean> {
  const key = EMAIL_API_KEY.value();
  const to = OWNER_EMAIL_TO.value();
  if (DISABLED.has(key) || DISABLED.has(to)) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": alert.key },
    body: JSON.stringify({ from: EMAIL_FROM.value(), to: list(to), subject: alert.subject, text: alert.lines.join("\n") }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`email ${response.status}`);
  return true;
}

/**
 * WhatsApp Business Cloud API template message to every number in OWNER_WHATSAPP_TO. Off until a sender
 * number id and token are set; the template must be approved in Meta Business Manager.
 */
async function sendWhatsApp(alert: TeamAlert): Promise<boolean> {
  const token = WHATSAPP_TOKEN.value();
  const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID.value();
  const to = list(OWNER_WHATSAPP_TO.value());
  if (!alert.whatsapp || DISABLED.has(token) || DISABLED.has(phoneNumberId) || !to.length) return false;
  const { template, params } = alert.whatsapp;
  for (const number of to) {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: number.replace(/^\+/, ""),
        type: "template",
        template: {
          name: template,
          language: { code: "en" },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`whatsapp ${response.status}`);
  }
  return true;
}

export const leadTemplate = () => WHATSAPP_TEMPLATE.value();
