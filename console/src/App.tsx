import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";

import { Loading, Shell } from "@/components/dashboard/Shell";
import { firebaseConfigured } from "@/lib/firebase/app";
import { rolesFor } from "@/lib/firebase/school";
import { useSession } from "@/lib/firebase/session";
import { pageFor, redirectFor } from "./routes";

const Setup = lazy(() => import("./Setup").then((m) => ({ default: m.Setup })));

// Each person downloads only their own page: a parent never loads the team's code, and so on.
const LoginPage = lazy(() =>
  import("@/components/dashboard/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const ParentPage = lazy(() =>
  import("@/components/dashboard/pages/ParentPage").then((m) => ({ default: m.ParentPage })),
);
const TeacherPage = lazy(() =>
  import("@/components/dashboard/pages/TeacherPage").then((m) => ({ default: m.TeacherPage })),
);
const AdminPage = lazy(() =>
  import("@/components/dashboard/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const NotFound = lazy(() => import("./NotFound"));

const TITLES = {
  login: "Log in | Stoodant",
  parent: "Your child's progress | Stoodant",
  teacher: "Teacher | Stoodant",
  admin: "Team | Stoodant",
  missing: "Page not found | Stoodant",
};

export function App() {
  const page = pageFor(location.pathname);
  useEffect(() => void (document.title = TITLES[page]), [page]);

  let body: ReactNode;
  if (page === "login") body = <LoginPage />;
  else if (page === "missing") body = <NotFound />;
  else {
    const Page = { parent: ParentPage, teacher: TeacherPage, admin: AdminPage }[page];
    body = (
      <RoleGate page={page}>
        <Page />
      </RoleGate>
    );
  }
  return <Suspense fallback={<Waiting />}>{body}</Suspense>;
}

function Waiting() {
  return (
    <Shell role="">
      <Loading />
    </Shell>
  );
}

/**
 * Keeps each person on their own pages: a teacher who opens /admin or a parent who opens /teacher is
 * taken to their own home. The database rules refuse the data anyway; this keeps the screens apart too.
 * Practice mode (?sample=1) needs no login, so it skips the check.
 */
function RoleGate({ page, children }: { page: "parent" | "teacher" | "admin"; children: ReactNode }) {
  const session = useSession();
  const params = new URLSearchParams(location.search);
  const sample = params.has("sample");
  const [allowed, setAllowed] = useState(sample || !firebaseConfigured);

  useEffect(() => {
    if (allowed || session === undefined) return;
    if (session === null) return location.replace("/login");
    if (session.admin) return setAllowed(true);
    let live = true;
    void rolesFor(session.phone).then((roles) => {
      if (!live) return;
      const to = redirectFor(page, { admin: false, ...roles });
      if (to) location.replace(to);
      else setAllowed(true);
    });
    return () => {
      live = false;
    };
  }, [allowed, session, page]);

  if (!allowed) return <Waiting />;
  return (
    <>
      {children}
      {((session && !sample) || (sample && params.has("setup"))) && (
        <Suspense>
          <Setup session={sample ? null : (session ?? null)} />
        </Suspense>
      )}
    </>
  );
}
