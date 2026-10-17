import { defineBoolean, defineInt, defineSecret, defineString } from "firebase-functions/params";

/** Every function runs in Mumbai, close to the audience and to Firestore. */
export const REGION = "asia-south1";

export const APP_CHECK_ENFORCED = defineBoolean("APP_CHECK_ENFORCED", { default: true });
/** Comma-separated; `*` matches one label part, e.g. https://stoodant-staging--*.web.app for previews. */
export const ALLOWED_ORIGINS = defineString("ALLOWED_ORIGINS", { default: "https://stoodant.com" });
export const RATE_LIMIT_PER_10_MIN = defineInt("RATE_LIMIT_PER_10_MIN", { default: 5 });
export const RATE_LIMIT_PER_DAY = defineInt("RATE_LIMIT_PER_DAY", { default: 20 });
export const MIN_FILL_MS = defineInt("MIN_FILL_MS", { default: 3000 });
/** Days a lead is kept unless it enrols (owner decision 2026-10-17: 3 months). */
export const LEAD_RETENTION_DAYS = defineInt("LEAD_RETENTION_DAYS", { default: 90 });

export const PHONE_HASH_PEPPER = defineSecret("PHONE_HASH_PEPPER");

// Owner alerts. Leave a value empty (or a secret as "disabled") to switch that channel off.
export const OWNER_EMAIL_TO = defineString("OWNER_EMAIL_TO", { default: "" });
export const EMAIL_FROM = defineString("EMAIL_FROM", { default: "Stoodant <leads@stoodant.com>" });
export const EMAIL_API_KEY = defineSecret("EMAIL_API_KEY");
export const OWNER_WHATSAPP_TO = defineString("OWNER_WHATSAPP_TO", { default: "" });
export const WHATSAPP_PHONE_NUMBER_ID = defineString("WHATSAPP_PHONE_NUMBER_ID", { default: "" });
export const WHATSAPP_TEMPLATE = defineString("WHATSAPP_TEMPLATE", { default: "new_demo_request" });
export const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
