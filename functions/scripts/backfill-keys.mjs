// One-off after deploying unique keys: gives every teacher and student made before then its nameKey
// and uniqueKeys entry, and lists records that share a key (duplicates for the team to merge by hand).
//   npm run build && GOOGLE_CLOUD_PROJECT=stoodant-prod node scripts/backfill-keys.mjs
// Uses the signed-in Google account (gcloud auth application-default login). Safe to run twice.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { keyOf, syncKeys } from "../lib/school/keys.js";

initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
const db = getFirestore();
const duplicates = [];

for (const kind of ["teachers", "students"]) {
  const snap = await db.collection(kind).get();
  for (const record of snap.docs) {
    await syncKeys(db, kind, record.id, undefined, record.data());
    const key = keyOf(kind, record.data());
    const holder = key ? (await db.doc(`uniqueKeys/${key}`).get()).get("id") : record.id;
    if (holder !== record.id) duplicates.push(`${kind}/${record.id} repeats ${kind}/${holder}`);
  }
  console.log(`${kind}: ${snap.size} checked`);
}
console.log(duplicates.length ? `Duplicates:\n${duplicates.join("\n")}` : "No duplicates.");
