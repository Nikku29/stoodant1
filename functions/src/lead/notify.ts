import { logger } from "firebase-functions";
import type { FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { alertTeam, leadTemplate } from "../notify/team.js";

/**
 * New lead → email, push and (once set up) WhatsApp to the team. Fires only when submitLead has checked and
 * saved a complete request. The outcome per channel is written back to the lead (`alerts`).
 */
export async function handleLeadCreated(event: FirestoreEvent<QueryDocumentSnapshot | undefined, { leadId: string }>): Promise<void> {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const leadId = event.params.leadId;
  const parentName = String(data.parentName);
  const studentClass = String(data.studentClass);
  const board = String(data.board);
  const phone = String(data.parentPhoneE164);
  const createdAt = new Date(snap.createTime.toMillis()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const alerts = await alertTeam({
    key: `lead-${leadId}`,
    subject: `New demo request: Class ${studentClass} ${board}`,
    lines: [
      `Parent: ${parentName}`,
      `Phone: ${phone}`,
      `Class: ${studentClass} (${board})`,
      `Received: ${createdAt} IST`,
      `Lead id: ${leadId}`,
    ],
    push: {
      title: "New demo request",
      body: `${parentName}, Class ${studentClass} ${board}. Call ${phone}.`,
      link: "/admin?tab=leads",
      tag: `lead-${leadId}`,
    },
    whatsapp: { template: leadTemplate(), params: [parentName, studentClass, board, phone] },
  });
  // A lead erased in the meantime (an erase request, or tests clearing the emulator) has nowhere to record it.
  await snap.ref.update({ alerts: { ...alerts, at: FieldValue.serverTimestamp() } }).catch((error: { code?: unknown }) => {
    if (error.code !== 5) throw error;
  });
  logger.info("lead_alerts", { leadId, ...alerts });
}
