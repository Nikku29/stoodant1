import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Loading, RequireLogin, Shell, useSearchFlag } from "@/components/dashboard/Shell";
import { TeacherEntry, type TeacherStore } from "@/components/dashboard/TeacherEntry";
import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { firebaseConfigured } from "@/lib/firebase/app";
import {
  istDay,
  listAll,
  loadSession,
  myBatches,
  myTeacherRecord,
  saveAssessment,
  saveNotes,
  saveSession,
  type Batch,
} from "@/lib/firebase/school";
import { signOutNow, useSession, type Session } from "@/lib/firebase/session";
import { SAMPLE_BATCH, SAMPLE_TODAY } from "@/lib/progress/sampleData";

// Teacher entry page for attendance, marks and notes. The signed-in teacher's batches; `?sample=1` is
// practice mode with a sample batch, where nothing is saved.
export const Route = createFileRoute("/teacher")({
  head: () => ({ meta: [{ title: "Teacher | Stoodant" }, { name: "robots", content: "noindex" }] }),
  component: TeacherPage,
});

function TeacherPage() {
  const sample = useSearchFlag("sample");
  if (sample === undefined)
    return (
      <Shell role="Teacher">
        <Loading />
      </Shell>
    );
  if (sample || !firebaseConfigured)
    return <TeacherEntry batch={SAMPLE_BATCH} today={SAMPLE_TODAY} />;
  return <LiveTeacher />;
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
  const [pick, setPick] = useState(0);
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

  const batch = batches?.[Math.min(pick, batches.length - 1)];
  const uid = session.user.uid;
  const store = useMemo<TeacherStore | undefined>(
    () =>
      batch && {
        loadAttendance: (date) => loadSession(batch.id, date),
        saveAttendance: (date, status, attendance) =>
          saveSession(batch, date, status, attendance, uid),
        saveMarks: (test) => saveAssessment(batch, test, uid),
        saveNotes: (date, notes) => saveNotes(batch, date, notes, uid),
      },
    [batch, uid],
  );

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
  if (batches && !batches.length) {
    return (
      <Shell role="Teacher" onSignOut={signOut}>
        <section className="pd-card pd-stack pd-welcome">
          <h1>{name ? `Welcome, ${name.split(" ")[0]}` : "Welcome"}</h1>
          <p>{DASHBOARD_CONFIG.teacher.noBatches}</p>
          <a className="pd-ghost pd-ghost-link" href="/teacher?sample=1">
            {DASHBOARD_CONFIG.teacher.tryPractice}
          </a>
        </section>
      </Shell>
    );
  }
  if (!batch || !store)
    return (
      <Shell role="Teacher" onSignOut={signOut}>
        <Loading />
      </Shell>
    );

  const picker =
    batches!.length > 1 ? (
      <div className="pd-picker" role="group" aria-label="Choose a batch">
        {batches!.map((b, i) => (
          <button key={b.id} type="button" aria-pressed={i === pick} onClick={() => setPick(i)}>
            {b.name}
          </button>
        ))}
      </div>
    ) : undefined;
  return (
    <TeacherEntry
      key={batch.id}
      batch={{ name: batch.name, schedule: batch.schedule, students: batch.roster ?? [] }}
      store={store}
      today={istDay()}
      picker={picker}
      onSignOut={signOut}
    />
  );
}
