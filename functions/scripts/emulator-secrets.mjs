// Writes throwaway secret values for the local emulator (functions/.secret.local, git-ignored).
// Real projects keep secrets in Secret Manager; see DEPLOY.md.
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const file = new URL("../.secret.local", import.meta.url);
if (!existsSync(file)) {
  writeFileSync(file, [
    `PHONE_HASH_PEPPER=${randomBytes(32).toString("hex")}`,
    "EMAIL_API_KEY=disabled",
    "WHATSAPP_TOKEN=disabled",
    "",
  ].join("\n"));
}
