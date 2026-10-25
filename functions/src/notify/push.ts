import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions/v2";

// Push notifications to the app (app.stoodant.com). Phones register in pushDevices/{sha256(token)} with
// the number they signed in with, or admin: true for the team (firestore.rules). Messages are data-only
// web pushes; the app's service worker (console/public/sw.js) shows them and opens `link` when tapped.

export type Push = {
  title: string;
  body: string;
  /** Page in the app to open, e.g. "/parent". */
  link: string;
  /** Same tag = replaces the earlier notification instead of stacking (e.g. one per class). */
  tag?: string;
};

const chunks = <T>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/** Tokens of every phone signed in with one of these numbers. */
async function tokensForPhones(db: Firestore, phones: string[]) {
  const unique = [...new Set(phones.filter(Boolean))];
  const found = await Promise.all(
    chunks(unique, 30).map((part) => db.collection("pushDevices").where("phone", "in", part).get()),
  );
  return found.flatMap((snap) => snap.docs);
}

async function send(db: Firestore, devices: FirebaseFirestore.QueryDocumentSnapshot[], push: Push) {
  const tokens = [...new Map(devices.map((d) => [String(d.get("token")), d])).entries()];
  if (!tokens.length) return 0;
  let delivered = 0;
  for (const part of chunks(tokens, 500)) {
    const result = await getMessaging().sendEachForMulticast({
      tokens: part.map(([token]) => token),
      data: { title: push.title, body: push.body, link: push.link, tag: push.tag ?? "" },
      webpush: { headers: { Urgency: "high", TTL: "3600" } },
    });
    delivered += result.successCount;
    // Phones that uninstalled the app or turned notifications off: forget them.
    const gone = result.responses
      .map((r, i) => (r.success ? null : { code: r.error?.code ?? "", doc: part[i]![1] }))
      .filter((r): r is { code: string; doc: FirebaseFirestore.QueryDocumentSnapshot } =>
        r !== null && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(r.code));
    await Promise.all(gone.map((g) => g.doc.ref.delete()));
    if (result.failureCount > gone.length)
      logger.warn("push: some messages failed", { failed: result.failureCount - gone.length });
  }
  return delivered;
}

export async function pushToPhones(phones: string[], push: Push, db = getFirestore()) {
  return send(db, await tokensForPhones(db, phones), push);
}

/** Every phone where someone from the Stoodant team is signed in. */
export async function pushToTeam(push: Push, db = getFirestore()) {
  const snap = await db.collection("pushDevices").where("admin", "==", true).get();
  return send(db, snap.docs, push);
}
