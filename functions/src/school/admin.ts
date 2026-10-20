import { getAuth } from "firebase-admin/auth";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { ADMIN_EMAILS } from "../config.js";

/**
 * The Stoodant team signs in with Google. A verified address on the ADMIN_EMAILS list gets the `admin`
 * claim the rules check; anyone else is turned away. Removing an address takes the claim away on that
 * person's next sign-in.
 */
export async function handleClaimAdmin(request: CallableRequest): Promise<{ admin: boolean }> {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Please sign in first.");
  const email = typeof auth.token.email === "string" ? auth.token.email.toLowerCase() : "";
  const allowed = ADMIN_EMAILS.value()
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = auth.token.email_verified === true && allowed.includes(email);
  if (isAdmin !== (auth.token.admin === true)) {
    await getAuth().setCustomUserClaims(auth.uid, isAdmin ? { admin: true } : null);
  }
  if (!isAdmin) throw new HttpsError("permission-denied", "This account is not on the Stoodant team list.");
  return { admin: true };
}
