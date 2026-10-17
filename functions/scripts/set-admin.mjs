// Gives a signed-in Google account the admin claim (read leads, move their status, add notes).
// Usage, after `gcloud auth application-default login`:
//   node scripts/set-admin.mjs <project-id> <email> [--remove]
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [projectId, email] = process.argv.slice(2);
if (!projectId || !email) {
  console.error("Usage: node scripts/set-admin.mjs <project-id> <email> [--remove]");
  process.exit(1);
}
initializeApp({ projectId, credential: applicationDefault() });
const user = await getAuth().getUserByEmail(email);
const admin = !process.argv.includes("--remove");
await getAuth().setCustomUserClaims(user.uid, { ...user.customClaims, admin });
console.log(`${email} admin=${admin} on ${projectId}. Sign out and in again for it to apply.`);
