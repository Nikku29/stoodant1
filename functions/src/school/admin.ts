import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { ADMIN_EMAILS } from "../config.js";

/** The owners' addresses from ADMIN_EMAILS. They always have access and can't be removed on /admin. */
const owners = () =>
  ADMIN_EMAILS.value()
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** An owner, or an address the team added on /admin (a `team/{email}` document). */
async function onTeam(email: string): Promise<boolean> {
  if (!email) return false;
  if (owners().includes(email)) return true;
  return (await getFirestore().doc(`team/${email}`).get()).exists;
}

/**
 * The Stoodant team signs in with Google. A verified address that is an owner or on the team list gets
 * the `admin` claim the rules check; anyone else is turned away.
 */
export async function handleClaimAdmin(
  request: CallableRequest,
): Promise<{ admin: boolean; owner: boolean }> {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Please sign in first.");
  const email = typeof auth.token.email === "string" ? auth.token.email.toLowerCase() : "";
  const isAdmin = auth.token.email_verified === true && (await onTeam(email));
  if (isAdmin !== (auth.token.admin === true)) {
    await getAuth().setCustomUserClaims(auth.uid, isAdmin ? { admin: true } : null);
  }
  if (!isAdmin)
    throw new HttpsError("permission-denied", "This account is not on the Stoodant team list.");
  return { admin: true, owner: owners().includes(email) };
}

/**
 * Removing someone on /admin takes their access away straight away: the claim goes and they are signed
 * out everywhere, instead of keeping access until their next sign-in.
 */
export async function handleTeamRemoved(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { email: string }>,
): Promise<void> {
  const email = event.params.email.toLowerCase();
  if (owners().includes(email)) return;
  let uid: string;
  try {
    const user = await getAuth().getUserByEmail(email);
    if (user.customClaims?.["admin"] !== true) return;
    uid = user.uid;
  } catch (e) {
    if ((e as { code?: string }).code === "auth/user-not-found") return;
    throw e;
  }
  await getAuth().setCustomUserClaims(uid, null);
  await getAuth().revokeRefreshTokens(uid);
}
