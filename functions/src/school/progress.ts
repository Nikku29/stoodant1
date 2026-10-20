import { FieldValue, type Firestore } from "firebase-admin/firestore";

// The parent dashboard reads one document per child, `progress/{studentId}`, in the same shape the
// browser's insights code takes (src/lib/progress/insights.ts StudentRecords). It is rebuilt here from
// what teachers enter, so a parent never reads a batch's shared attendance or marks sheet.

type AttendanceStatus = "present" | "late" | "absent" | "cancelled";
type AttendanceRecord = { date: string; subject: string; status: AttendanceStatus };
type TestRecord = { date: string; subject: string; title: string; score: number | null; max: number };
type TeacherNote = { date: string; subject: string; teacher: string; lines: string[] };

const MARKS = new Set(["present", "late", "absent"]);
const str = (value: unknown) => (typeof value === "string" ? value : "");
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

/** Firestore `in` filters take at most 30 values; a child is in a handful of batches. */
const chunks = <T>(items: T[], size = 30) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

export async function rebuildProgress(db: Firestore, studentId: string): Promise<void> {
  const ref = db.doc(`progress/${studentId}`);
  const studentSnap = await db.doc(`students/${studentId}`).get();
  const student = studentSnap.data();
  if (!student || student.active === false) {
    await ref.delete();
    return;
  }
  const batchIds = (Array.isArray(student.batchIds) ? student.batchIds : []).filter((id): id is string => typeof id === "string");
  const batches = new Map<string, FirebaseFirestore.DocumentData>();
  const attendance: AttendanceRecord[] = [];
  const tests: TestRecord[] = [];

  for (const ids of chunks(batchIds)) {
    const [batchSnaps, sessionSnaps, assessmentSnaps] = await Promise.all([
      db.getAll(...ids.map((id) => db.doc(`batches/${id}`))),
      db.collection("sessions").where("batchId", "in", ids).get(),
      db.collection("assessments").where("batchId", "in", ids).get(),
    ]);
    for (const snap of batchSnaps) if (snap.exists) batches.set(snap.id, snap.data()!);
    for (const snap of sessionSnaps.docs) {
      const s = snap.data();
      if (!isDate(s.date)) continue;
      const subject = str(s.subject) || str(batches.get(s.batchId)?.subject);
      if (s.status === "cancelled") {
        attendance.push({ date: s.date, subject, status: "cancelled" });
        continue;
      }
      // A child who joined the batch after this class has no mark for it, so it doesn't count.
      const mark = s.attendance?.[studentId];
      if (MARKS.has(mark)) attendance.push({ date: s.date, subject, status: mark });
    }
    for (const snap of assessmentSnaps.docs) {
      const a = snap.data();
      if (!isDate(a.date) || !a.scores || !(studentId in a.scores)) continue;
      const score = a.scores[studentId];
      tests.push({
        date: a.date,
        subject: str(a.subject) || str(batches.get(a.batchId)?.subject),
        title: str(a.title),
        score: typeof score === "number" ? score : null,
        max: typeof a.max === "number" ? a.max : 0,
      });
    }
  }

  const noteSnaps = await db.collection("notes").where("studentId", "==", studentId).get();
  const notes: TeacherNote[] = noteSnaps.docs
    .map((snap) => snap.data())
    .filter((n) => isDate(n.date) && Array.isArray(n.lines))
    .map((n) => ({ date: n.date, subject: str(n.subject), teacher: str(n.teacherName), lines: n.lines.map(str).filter(Boolean) }));

  const active = batchIds.map((id) => batches.get(id)).filter((b): b is FirebaseFirestore.DocumentData => Boolean(b));
  await ref.set({
    student: {
      id: studentId,
      name: str(student.name),
      classLevel: str(student.classLevel),
      board: str(student.board),
      batch: active.map((b) => str(b.name)).join(" · "),
      parentName: str(student.parentName),
      // Which batches' study material this child's parent may open.
      batchIds: batchIds.filter((id) => batches.has(id)),
      subjects: [...new Set(active.map((b) => str(b.subject)).filter(Boolean))],
    },
    attendance: attendance.sort(byDate),
    tests: tests.sort(byDate),
    notes: notes.sort(byDate),
    // Parents find their child's page by the phone number they signed in with (firestore.rules).
    parentPhone: str(student.parentPhone),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
