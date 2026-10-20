// Study material: notes, past papers (PYQs), homework and worksheets a teacher shares with a batch.
// A file goes to Storage under materials/{batchId}/{materialId}/, a link is stored as it is. The Storage
// code loads only when a file is uploaded, opened or removed, so the pages stay light until then.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore/lite";
import type { FirebaseStorage } from "firebase/storage";

import { firebaseApp } from "./app";
import { firebase } from "./session";

export type MaterialKind = "notes" | "pyq" | "homework" | "worksheet" | "other";
export type Material = {
  id: string;
  batchId: string;
  title: string;
  kind: MaterialKind;
  description?: string;
  link?: string;
  file?: { path: string; name: string; size: number; type: string };
  teacherName: string;
  createdBy: string;
  createdAt?: { toMillis(): number };
};

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** What a teacher may upload: PDFs, photos of pages, Word, PowerPoint, Excel and plain text. */
export const ACCEPT = ".pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";
/** The same list the Storage rules allow. */
export const allowedType = (type: string) =>
  /^(application\/pdf|image\/.+|application\/msword|application\/vnd\.openxmlformats-officedocument\..+|application\/vnd\.ms-.+|text\/plain)$/.test(
    type,
  );

let storage:
  Promise<{ sdk: typeof import("firebase/storage"); bucket: FirebaseStorage }> | undefined;
function bucket() {
  storage ??= import("firebase/storage").then((sdk) => {
    const bucket = sdk.getStorage(firebaseApp());
    if (import.meta.env["VITE_USE_EMULATORS"] === "1")
      sdk.connectStorageEmulator(bucket, "127.0.0.1", 9199);
    return { sdk, bucket };
  });
  return storage;
}

/** Some phones send no type for Word or Excel files; the extension says what it is. */
const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};
export const fileType = (file: { name: string; type: string }) =>
  file.type || BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] || "";

const db = () => firebase().db;

/** Newest first. One query per batch, so the rules can check each batch on its own. */
export async function materialsFor(batchIds: string[]): Promise<Material[]> {
  const lists = await Promise.all(
    batchIds.map((id) => getDocs(query(collection(db(), "materials"), where("batchId", "==", id)))),
  );
  return lists
    .flatMap((snap) => snap.docs.map((d) => ({ ...(d.data() as Omit<Material, "id">), id: d.id })))
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

/** Uploads the file first (if any), then saves the entry that points at it. */
export async function addMaterial(input: {
  batchId: string;
  title: string;
  kind: MaterialKind;
  description: string;
  link?: string | undefined;
  file?: File | undefined;
  teacherName: string;
  uid: string;
}) {
  const id = doc(collection(db(), "materials")).id;
  const entry: Record<string, unknown> = {
    batchId: input.batchId,
    title: input.title,
    kind: input.kind,
    teacherName: input.teacherName,
    createdBy: input.uid,
    createdAt: serverTimestamp(),
  };
  if (input.description) entry["description"] = input.description;
  if (input.file) {
    const name = input.file.name.replace(/[^\w.\- ()]+/g, "_").slice(-120) || "file";
    const path = `materials/${input.batchId}/${id}/${name}`;
    const type = fileType(input.file);
    const { sdk, bucket: b } = await bucket();
    await sdk.uploadBytes(sdk.ref(b, path), input.file, { contentType: type });
    entry["file"] = { path, name, size: input.file.size, type };
  } else {
    entry["link"] = input.link;
  }
  await setDoc(doc(db(), "materials", id), entry);
}

export async function removeMaterial(m: Material) {
  await deleteDoc(doc(db(), "materials", m.id));
  if (!m.file) return;
  const { sdk, bucket: b } = await bucket();
  await sdk.deleteObject(sdk.ref(b, m.file.path)).catch(() => undefined);
}

/** A link that opens the file; files need a fresh signed link each time. */
export async function openUrl(m: Material): Promise<string> {
  if (m.link) return m.link;
  const { sdk, bucket: b } = await bucket();
  return sdk.getDownloadURL(sdk.ref(b, m.file!.path));
}

export const kindLabel: Record<MaterialKind, string> = {
  notes: "Notes",
  pyq: "Past papers (PYQs)",
  homework: "Homework",
  worksheet: "Worksheet",
  other: "Other",
};

export function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
