import { logger } from "firebase-functions";
import type { FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  EMAIL_API_KEY, EMAIL_FROM, OWNER_EMAIL_TO, OWNER_WHATSAPP_TO, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE,
  WHATSAPP_TOKEN,
} from "../config.js";
import { withRetry } from "../lib/retry.js";

type AlertStatus = "sent" | "failed" | "skipped";
type LeadAlert = { parentName: string; studentClass: string; board: string; phone: string; leadId: string; createdAt: string };

const DISABLED = new Set(["", "disabled"]);

/**
 * New lead → email and WhatsApp to the owner. Each channel retries on its own and never blocks the other;
 * the outcome per channel is written back to the lead (`alerts`) so it is visible in the console.
 */
export async function handleLeadCreated(event: FirestoreEvent<QueryDocumentSnapshot | undefined, { leadId: string }>): Promise<void> {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const alert: LeadAlert = {
    leadId: event.params.leadId,
    parentName: String(data.parentName),
    studentClass: String(data.studentClass),
    board: String(data.board),
    phone: String(data.parentPhoneE164),
    createdAt: new Date(snap.createTime.toMillis()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  };
  const [email, whatsapp] = await Promise.all([
    deliver("email", () => sendEmail(alert)),
    deliver("whatsapp", () => sendWhatsApp(alert)),
  ]);
  await snap.ref.update({ alerts: { email, whatsapp, at: FieldValue.serverTimestamp() } });
  logger.info("lead_alerts", { leadId: alert.leadId, email, whatsapp });
}

async function deliver(channel: string, send: () => Promise<boolean>): Promise<AlertStatus> {
  try {
    return (await withRetry(send)) ? "sent" : "skipped";
  } catch (error) {
    logger.error("lead_alert_failed", { channel, message: error instanceof Error ? error.message : "unknown" });
    return "failed";
  }
}

/** Resend's REST API (https://resend.com/docs/api-reference/emails/send-email). Returns false when switched off. */
async function sendEmail(alert: LeadAlert): Promise<boolean> {
  const key = EMAIL_API_KEY.value();
  const to = OWNER_EMAIL_TO.value();
  if (DISABLED.has(key) || DISABLED.has(to)) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `lead-${alert.leadId}` },
    body: JSON.stringify({
      from: EMAIL_FROM.value(),
      to: to.split(",").map((value) => value.trim()),
      subject: `New demo request: Class ${alert.studentClass} ${alert.board}`,
      text: [
        `Parent: ${alert.parentName}`,
        `Phone: ${alert.phone}`,
        `Class: ${alert.studentClass} (${alert.board})`,
        `Received: ${alert.createdAt} IST`,
        `Lead id: ${alert.leadId}`,
      ].join("\n"),
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`email ${response.status}`);
  return true;
}

/**
 * WhatsApp Business Cloud API template message. The template (default "new_demo_request", language en)
 * must be approved in Meta Business Manager with four body variables: name, class, board, phone.
 */
async function sendWhatsApp(alert: LeadAlert): Promise<boolean> {
  const token = WHATSAPP_TOKEN.value();
  const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID.value();
  const to = OWNER_WHATSAPP_TO.value();
  if (DISABLED.has(token) || DISABLED.has(phoneNumberId) || DISABLED.has(to)) return false;
  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: WHATSAPP_TEMPLATE.value(),
        language: { code: "en" },
        components: [{
          type: "body",
          parameters: [alert.parentName, alert.studentClass, alert.board, alert.phone].map((text) => ({ type: "text", text })),
        }],
      },
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`whatsapp ${response.status}`);
  return true;
}
