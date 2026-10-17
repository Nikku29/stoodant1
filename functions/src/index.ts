import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { EMAIL_API_KEY, PHONE_HASH_PEPPER, REGION, WHATSAPP_TOKEN } from "./config.js";
import { handleSubmitLead } from "./lead/submit.js";
import { handleLeadCreated } from "./lead/notify.js";

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
