import { useCallback, useEffect, useMemo, useState } from "react";

import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { Loading, RequireLogin, Shell, useSearchFlag } from "@/components/dashboard/Shell";
import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { SITE_CONFIG } from "@/config/siteConfig";
import { firebaseConfigured } from "@/lib/firebase/app";
import { classesFor, markJoined } from "@/lib/firebase/classes";
import { materialsFor, openUrl } from "@/lib/firebase/materials";
import { istDay, myChildren, progressOf, type Progress } from "@/lib/firebase/school";
import { signOutNow, useSession, type Session } from "@/lib/firebase/session";
import { SAMPLE_MATERIALS, SAMPLE_RECORDS, SAMPLE_TODAY } from "@/lib/progress/sampleData";
import { sampleClasses } from "@/components/dashboard/practiceClasses";
import { useMoveToApp } from "@/lib/moveToApp";
import { isDone, noticesFor, setDone } from "@/lib/firebase/notices";
import { previewFamilyStore, type FamilyNoticeStore } from "@/components/dashboard/Notices";

// Parent dashboard: the signed-in parent's child (or children). `?sample=1` shows the preview with sample
// records. Used by the /parent route here and by app.stoodant.com (console/), never by the landing page.
export function ParentPage() {
  useMoveToApp();
  const sample = useSearchFlag("sample");
  if (sample === undefined)
    return (
      <Shell role="Parent">
        <Loading />
      </Shell>
    );
  if (sample || !firebaseConfigured)
    return (
      <ParentDashboard
        records={SAMPLE_RECORDS}
        today={SAMPLE_TODAY}
        sample
        materials={{ load: loadSampleMaterials }}
        classes={{ load: loadSampleClasses }}
        notices={sampleNotices}
      />
    );
  return <LiveParent />;
}

const loadSampleMaterials = async () => SAMPLE_MATERIALS;
const loadSampleClasses = async () => sampleClasses();
const sampleNotices = previewFamilyStore(SAMPLE_TODAY);

function LiveParent() {
  const session = useSession();
  if (session === undefined)
    return (
      <Shell role="Parent">
        <Loading />
      </Shell>
    );
  if (session === null)
    return (
      <Shell role="Parent">
        <RequireLogin />
      </Shell>
    );
  return <Children session={session} />;
}

function Children({ session }: { session: Session }) {
  const [children, setChildren] = useState<Progress[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pick, setPick] = useState(0);

  useEffect(() => {
    // The team can open any child's page from /admin with ?student=<id>.
    const studentId = new URLSearchParams(location.search).get("student");
    const load =
      session.admin && studentId
        ? progressOf(studentId).then((p) => (p ? [p] : []))
        : myChildren(session.phone);
    load.then(setChildren).catch(() => setFailed(true));
  }, [session]);

  const signOut = () => void signOutNow().then(() => location.assign("/login"));
  if (failed || (children && !children.length)) {
    return (
      <Shell role="Parent" onSignOut={signOut}>
        <p className="pd-alert">
          {failed
            ? "We couldn't load your child's page. Please check the internet connection and refresh."
            : DASHBOARD_CONFIG.login.notFound}
        </p>
        <a
          className="pd-cta"
          href={`https://wa.me/${SITE_CONFIG.contact.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Message us on WhatsApp
        </a>
      </Shell>
    );
  }
  if (!children)
    return (
      <Shell role="Parent" onSignOut={signOut}>
        <Loading />
      </Shell>
    );

  const child = children[Math.min(pick, children.length - 1)]!;
  return (
    <Child
      child={child}
      all={children}
      pick={pick}
      setPick={setPick}
      signOut={signOut}
      uid={session.admin ? null : session.user.uid}
    />
  );
}

function Child({
  child,
  all,
  pick,
  setPick,
  signOut,
  uid,
}: {
  uid: string | null;
  child: Progress;
  all: Progress[];
  pick: number;
  setPick: (i: number) => void;
  signOut: () => void;
}) {
  const batchIds = (child.student.batchIds ?? []).join(",");
  const load = useCallback(() => materialsFor(batchIds ? batchIds.split(",") : []), [batchIds]);
  const loadClasses = useCallback(() => classesFor(batchIds ? batchIds.split(",") : []), [batchIds]);
  const studentId = child.student.id;
  // The team viewing a child's page doesn't count as the child joining.
  const onJoin = useCallback(
    (c: { id: string }) => void (uid && markJoined(c.id, studentId, uid).catch(() => undefined)),
    [uid, studentId],
  );
  const notices = useMemo<FamilyNoticeStore>(
    () => ({
      list: async () => {
        const items = await noticesFor(batchIds ? batchIds.split(",") : []);
        const done = await Promise.all(
          items.map((n) => (n.kind === "homework" ? isDone(n.id, studentId).catch(() => false) : false)),
        );
        return items.map((n, i) => ({ ...n, done: done[i]! }));
      },
      // The team viewing a child's page can't tick for them; the rules refuse it and the tick goes back.
      setDone: (id, done) => (uid ? setDone(id, studentId, uid, done) : Promise.reject(new Error("view only"))),
    }),
    [batchIds, studentId, uid],
  );
  const picker =
    all.length > 1 ? (
      <div className="pd-picker" role="group" aria-label="Choose a child">
        {all.map((c, i) => (
          <button
            key={c.student.id}
            type="button"
            aria-pressed={i === pick}
            onClick={() => setPick(i)}
          >
            {c.student.name.split(" ")[0]}
          </button>
        ))}
      </div>
    ) : undefined;
  return (
    <ParentDashboard
      key={child.student.id}
      records={child}
      today={istDay()}
      picker={picker}
      onSignOut={signOut}
      materials={{ load, open: openUrl }}
      classes={{ load: loadClasses, onJoin }}
      notices={notices}
    />
  );
}
