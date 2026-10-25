import { useEffect, useMemo, useState } from "react";

import { practiceClassStore } from "@/components/dashboard/practiceClasses";
import { Loading, RequireLogin, Shell, useSearchFlag } from "@/components/dashboard/Shell";
import { TeacherApp, type TeacherBatch } from "@/components/dashboard/TeacherApp";
import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { firebaseConfigured } from "@/lib/firebase/app";
import { changeClass, classesFor, joinedIn, lastLink, scheduleClasses } from "@/lib/firebase/classes";
import { addMaterial, materialsFor, openUrl, removeMaterial } from "@/lib/firebase/materials";
import { addNotice, doneCount, noticesFor, removeNotice } from "@/lib/firebase/notices";
import { istIso, istParts } from "@/lib/classes/time";
import {
  istDay,
  listAll,
  loadSession,
  batchHistory,
  batchNotes,
  deleteAssessment,
  myBatches,
  myTeacherRecord,
  saveAssessment,
  saveNotes,
  saveSession,
  type Batch,
} from "@/lib/firebase/school";
import { signOutNow, useSession, type Session } from "@/lib/firebase/session";
import type { TeacherStore } from "@/components/dashboard/TeacherEntry";
import { SAMPLE_BATCH, SAMPLE_TODAY } from "@/lib/progress/sampleData";
import { useMoveToApp } from "@/lib/moveToApp";

// Teacher entry page for attendance, marks and notes. The signed-in teacher's batches; `?sample=1` is
// practice mode with a sample batch, where nothing is saved. Used by /teacher here and by app.stoodant.com.
export function TeacherPage() {
  useMoveToApp();
  const sample = useSearchFlag("sample");
  if (sample === undefined)
    return (
      <Shell role="Teacher">
        <Loading />
      </Shell>
    );
  if (sample || !firebaseConfigured) return <PracticeTeacher />;
  return <LiveTeacher />;
}

/** Practice mode: the sample batch, with classes kept in memory. Nothing is saved or sent. */
function PracticeTeacher() {
  const practice = useMemo(() => {
    const classes = practiceClassStore();
    const batches: TeacherBatch[] = [{ id: "sample", batch: SAMPLE_BATCH }];
    return { classes, batches, load: () => classes.list() };
  }, []);
  return (
    <TeacherApp
      name="Priya"
      batches={practice.batches}
      today={SAMPLE_TODAY}
      loadClasses={practice.load}
      practiceClasses={practice.classes}
      practice
    />
  );
}

function LiveTeacher() {
  const session = useSession();
  if (session === undefined)
    return (
      <Shell role="Teacher">
        <Loading />
      </Shell>
    );
  if (session === null)
    return (
      <Shell role="Teacher">
        <RequireLogin />
      </Shell>
    );
  return <Batches session={session} />;
}

function Batches({ session }: { session: Session }) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!session.admin)
      void myTeacherRecord(session.phone).then(
        (t) => setName(t?.name ?? ""),
        () => undefined,
      );
    // The team can fill in for a teacher, so they see every running batch.
    const load = session.admin
      ? listAll.batches().then((all) => all.filter((b) => b.active !== false))
      : myBatches(session.phone);
    load.then(setBatches).catch(() => setFailed(true));
  }, [session]);

  const uid = session.user.uid;
  const app = useMemo(() => {
    if (!batches) return null;
    const list: TeacherBatch[] = batches.map((batch) => ({
      id: batch.id,
      batch: {
        name: batch.name,
        schedule: batch.schedule,
        subject: batch.subject,
        durationMinutes: batch.durationMinutes ?? 60,
        students: batch.roster ?? [],
      },
      store: storeFor(batch, uid, session.admin ? "Stoodant team" : name || batch.teacherName || "Teacher"),
    }));
    const ids = batches.map((b) => b.id);
    // From midnight, so the Today screen also lists this morning's classes.
    return { list, load: () => classesFor(ids, Date.parse(istIso(istDay(), "00:00"))) };
  }, [batches, uid, name, session.admin]);

  const signOut = () => void signOutNow().then(() => location.assign("/login"));
  if (failed) {
    return (
      <Shell role="Teacher" onSignOut={signOut}>
        <p className="pd-alert">
          We couldn't load your batches. Please check the internet connection and refresh.
        </p>
      </Shell>
    );
  }
  if (!app)
    return (
      <Shell role="Teacher" onSignOut={signOut}>
        <Loading />
      </Shell>
    );
  return (
    <TeacherApp
      name={session.admin ? "" : name}
      batches={app.list}
      today={istDay()}
      loadClasses={app.load}
      onSignOut={signOut}
    />
  );
}

/** Where one batch's records are read and saved. */
function storeFor(batch: Batch, uid: string, teacherName: string): TeacherStore {
  return {
    loadAttendance: (date) => loadSession(batch.id, date),
    saveAttendance: (date, status, attendance) => saveSession(batch, date, status, attendance, uid),
    saveMarks: (test) => saveAssessment(batch, test, uid),
    saveNotes: (date, notes) => saveNotes(batch, date, notes, uid),
    loadHistory: () => batchHistory(batch.id),
    deleteTest: (id) => deleteAssessment(id),
    loadNotes: () => batchNotes(batch.id),
    listMaterials: () => materialsFor([batch.id]),
    addMaterial: (m) => addMaterial({ ...m, batchId: batch.id, uid, teacherName: teacherName.slice(0, 80) }),
    removeMaterial,
    openMaterial: openUrl,
    notices: {
      list: () => noticesFor([batch.id]),
      add: (n) => addNotice(batch, n, { uid, name: teacherName }),
      remove: removeNotice,
      doneCount,
    },
    classes: {
      list: () => classesFor([batch.id]),
      lastLink: () => lastLink(batch.id),
      schedule: (input) => scheduleClasses({ ...input, batchId: batch.id }),
      change: changeClass,
    },
    joinedOn: async (date) => {
      const dayStart = Date.parse(istIso(date, "00:00"));
      const ids = (await classesFor([batch.id], dayStart))
        .filter((c) => c.status === "scheduled" && istParts(c.startAt).date === date)
        .map((c) => c.id);
      const joined = ids.length ? await joinedIn(ids) : new Set<string>();
      return joined.size ? joined : null;
    },
  };
}
