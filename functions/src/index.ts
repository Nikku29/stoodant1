import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentDeleted, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { EMAIL_API_KEY, PHONE_HASH_PEPPER, REGION, WHATSAPP_TOKEN } from "./config.js";
import { handleSubmitLead } from "./lead/submit.js";
import { handleLeadCreated } from "./lead/notify.js";
import { handleClaimAdmin, handleTeamRemoved } from "./school/admin.js";
import { sendClassReminders } from "./classes/reminders.js";
import { handleChangeClass, handleScheduleClasses } from "./classes/schedule.js";
import {
  handleBatchWritten, handleNoteWritten, handleSheetWritten, handleStudentWritten, handleTeacherWritten, logged,
} from "./school/triggers.js";

initializeApp();

// Cost guard on every function (v10): small instances, a hard cap on scale-out.
setGlobalOptions({ region: REGION, maxInstances: 5, memory: "256MiB", timeoutSeconds: 10 });

export const submitLead = onRequest(
  { concurrency: 40, invoker: "public", secrets: [PHONE_HASH_PEPPER] },
  handleSubmitLead,
);

export const onLeadCreated = onDocumentCreated(
  { document: "leads/{leadId}", timeoutSeconds: 30, secrets: [EMAIL_API_KEY, WHATSAPP_TOKEN] },
  handleLeadCreated,
);

// Log-ins and progress (PROGRESS_PLAN.md). Rebuilding a child's page reads a few small collections.
const school = { timeoutSeconds: 60 };

export const claimAdmin = onCall({ cors: true }, handleClaimAdmin);
export const onTeamRemoved = onDocumentDeleted(
  { ...school, document: "team/{email}" },
  handleTeamRemoved,
);

export const onStudentWritten = onDocumentWritten(
  { ...school, document: "students/{studentId}" },
  logged("onStudentWritten", handleStudentWritten),
);
export const onTeacherWritten = onDocumentWritten(
  { ...school, document: "teachers/{teacherId}" },
  logged("onTeacherWritten", handleTeacherWritten),
);
export const onBatchWritten = onDocumentWritten(
  { ...school, document: "batches/{batchId}" },
  logged("onBatchWritten", handleBatchWritten),
);
export const onSessionWritten = onDocumentWritten(
  { ...school, document: "sessions/{sessionId}" },
  logged("onSessionWritten", handleSheetWritten("attendance")),
);
export const onAssessmentWritten = onDocumentWritten(
  { ...school, document: "assessments/{assessmentId}" },
  logged("onAssessmentWritten", handleSheetWritten("scores")),
);
export const onNoteWritten = onDocumentWritten(
  { ...school, document: "notes/{noteId}" },
  logged("onNoteWritten", handleNoteWritten),
);

// Live classes (app.stoodant.com): teachers schedule, move and cancel; families get a push straight away
// and a reminder 5 minutes before. The reminder job is one small query a minute.
export const scheduleClasses = onCall({ cors: true, timeoutSeconds: 30 }, handleScheduleClasses);
export const changeClass = onCall({ cors: true, timeoutSeconds: 30 }, handleChangeClass);
export const classReminders = onSchedule(
  { schedule: "every 1 minutes", timeZone: "Asia/Kolkata", timeoutSeconds: 50, maxInstances: 1, retryCount: 0 },
  async () => {
    await sendClassReminders();
  },
);
