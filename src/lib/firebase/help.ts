// "Need help?" requests: parents and teachers send them through the askForHelp function (which alerts the
// team); the team lists them on /admin and marks them done.
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore/lite";

import { firebase } from "./session";

export type HelpTopic = "class" | "login" | "fees" | "other";
export type HelpRequest = {
  id: string;
  phone: string;
  role: "parent" | "teacher" | "unknown";
  name: string;
  topic: HelpTopic;
  message: string;
  status: "open" | "done";
  createdAt?: { toDate(): Date };
};

export const askForHelp = (topic: HelpTopic, message: string) =>
  firebase().call<{ saved: true }>("askForHelp", { topic, message });

export async function listHelp(): Promise<HelpRequest[]> {
  const snap = await getDocs(query(collection(firebase().db, "helpRequests"), orderBy("createdAt", "desc"), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HelpRequest, "id">) }));
}

export const closeHelp = (id: string, uid: string) =>
  updateDoc(doc(firebase().db, "helpRequests", id), { status: "done", closedBy: uid, closedAt: serverTimestamp() });
