import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { EMAIL_API_KEY, PHONE_HASH_PEPPER, REGION, WHATSAPP_TOKEN } from "./config.js";
import { handleSubmitLead } from "./lead/submit.js";
import { handleLeadCreated } from "./lead/notify.js";
import { handleSubmitScholarship } from "./scholarship/submit.js";
import { handleScholarshipPayment } from "./scholarship/payment.js";
import { handleScholarshipUpdated } from "./scholarship/roll.js";
import { finishExpiredAttempts, handleScholarshipExam, handleScholarshipSlot } from "./scholarship/exam/handlers.js";
import { handleAskForHelp, handleHelpRequested } from "./help/ask.js";
import { handleNoticeCreated } from "./notices/notify.js";
import { handleDoubtCreated, handleDoubtUpdated } from "./doubts/notify.js";
import { handleApplyCoupon, handleFeeWritten } from "./fees/fees.js";
import { handleRecordPayment, handleStartPayment, runBillingDay } from "./billing/billing.js";
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

// Scholarship test registrations from stoodant.com/scholarship (photo included, so a larger body and a little more time).
export const submitScholarship = onRequest(
  { concurrency: 40, invoker: "public", timeoutSeconds: 30, memory: "512MiB", maxInstances: 10, secrets: [PHONE_HASH_PEPPER] },
  handleSubmitScholarship,
);

// The parent's UPI reference for the scholarship test fee, sent from the same page after paying.
export const scholarshipPayment = onRequest(
  { concurrency: 40, invoker: "public", timeoutSeconds: 15, maxInstances: 5, secrets: [PHONE_HASH_PEPPER] },
  handleScholarshipPayment,
);

// The family picks the exam hour once the fee is confirmed.
export const scholarshipSlot = onRequest(
  { concurrency: 80, invoker: "public", timeoutSeconds: 15, maxInstances: 10, secrets: [PHONE_HASH_PEPPER] },
  handleScholarshipSlot,
);

// The online test itself: log in (roll number + date of birth) inside the booked hour, autosave, submit.
// A whole slot (up to the capacity set in /admin) can start within minutes, so it scales wide.
export const scholarshipExam = onRequest(
  { concurrency: 80, invoker: "public", timeoutSeconds: 20, memory: "512MiB", minInstances: 0, maxInstances: 40, secrets: [PHONE_HASH_PEPPER] },
  handleScholarshipExam,
);
export const scholarshipExamClose = onSchedule(
  { schedule: "every 5 minutes", timeZone: "Asia/Kolkata", timeoutSeconds: 240, maxInstances: 1, retryCount: 0 },
  async () => {
    await finishExpiredAttempts();
  },
);

// The team confirmed the fee in /admin: the child gets an exam roll number.
export const onScholarshipUpdated = onDocumentUpdated(
  { document: "scholarshipRegistrations/{regNo}", timeoutSeconds: 30 },
  handleScholarshipUpdated,
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

// "Need help?" from parents and teachers: saved, then the team gets an email and a push.
export const askForHelp = onCall({ cors: true }, handleAskForHelp);
export const onHelpRequested = onDocumentCreated(
  { document: "helpRequests/{requestId}", timeoutSeconds: 30, secrets: [EMAIL_API_KEY, WHATSAPP_TOKEN] },
  handleHelpRequested,
);

// Fees by UPI: coupon codes are checked here (families can't read them); the family hears when a fee is
// added or confirmed, the team when a family says they've paid.
export const applyCoupon = onCall({ cors: true, timeoutSeconds: 20 }, handleApplyCoupon);
export const onFeeWritten = onDocumentWritten(
  { document: "fees/{feeId}", timeoutSeconds: 60, secrets: [EMAIL_API_KEY, WHATSAPP_TOKEN] },
  handleFeeWritten,
);

// Monthly plans: the family picks how many months and pays (startPayment works out the amount); the team
// records cash or bank payments and free months. Every morning plans move along (ending, a few grace days,
// paused) and families get one reminder per step.
export const startPayment = onCall({ cors: true, timeoutSeconds: 20 }, handleStartPayment);
export const recordPayment = onCall({ cors: true, timeoutSeconds: 30 }, handleRecordPayment);
export const billingDaily = onSchedule(
  { schedule: "every day 08:00", timeZone: "Asia/Kolkata", timeoutSeconds: 540, maxInstances: 1, retryCount: 1 },
  async () => {
    await runBillingDay();
  },
);

// Doubts: the teacher gets a push when a family asks, and the family when the teacher answers.
export const onDoubtCreated = onDocumentCreated(
  { document: "doubts/{doubtId}", timeoutSeconds: 30 },
  handleDoubtCreated,
);
export const onDoubtAnswered = onDocumentUpdated(
  { document: "doubts/{doubtId}", timeoutSeconds: 30 },
  handleDoubtUpdated,
);

// Homework and notices: the batch's families get a push as soon as the teacher posts one.
export const onNoticeCreated = onDocumentCreated(
  { document: "notices/{noticeId}", timeoutSeconds: 30 },
  handleNoticeCreated,
);
