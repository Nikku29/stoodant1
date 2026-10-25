import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import {
  addLeadNote,
  addTeamMember,
  allProgress,
  deleteLead,
  deleteRecord,
  DuplicateRecord,
  istDay,
  listAll,
  removeTeamMember,
  saveRecord,
  setLeadStatus,
  type Batch,
  type Lead,
  type Progress,
  type Student,
  type Teacher,
  type TeamMember,
} from "@/lib/firebase/school";
import { closeHelp, listHelp, type HelpRequest } from "@/lib/firebase/help";
import { indianMobile, signOutNow, useSession, type Session } from "@/lib/firebase/session";
import { overview } from "@/lib/progress/insights";
import { classesFor, type LiveClass } from "@/lib/firebase/classes";
import { istIso, statusLine, time12 } from "@/lib/classes/time";
import { Overview } from "./AdminReports";
import { Tile, useSection, type Nav } from "./AppNav";
import { Loading, RequireLogin, Shell } from "./Shell";
import { useMoveToApp } from "@/lib/moveToApp";

const copy = DASHBOARD_CONFIG.admin;
type Tab = keyof typeof copy.tabs;
const CLASSES = ["4", "5", "6", "7", "8", "9", "10"];
const BOARDS = ["CBSE", "ICSE"] as const;
const signOut = () => void signOutNow().then(() => location.assign("/login"));

/** The team's page: demo requests, and the students, teachers and batches that the other pages run on. */
export function AdminPage() {
  useMoveToApp();
  const session = useSession();
  if (session === undefined)
    return (
      <Shell role="Team">
        <Loading />
      </Shell>
    );
  if (session === null)
    return (
      <Shell role="Team">
        <RequireLogin />
      </Shell>
    );
  if (!session.admin) {
    return (
      <Shell role="Team" onSignOut={signOut}>
        <p className="pd-alert">{DASHBOARD_CONFIG.login.teamDenied}</p>
      </Shell>
    );
  }
  return <Admin session={session} />;
}

export type Data = {
  leads: Lead[];
  students: Student[];
  teachers: Teacher[];
  batches: Batch[];
  team: TeamMember[];
  progress: Progress[];
  help: HelpRequest[];
};

type Section = keyof typeof DASHBOARD_CONFIG.nav.admin;
type People = keyof typeof DASHBOARD_CONFIG.home.peopleTabs;
const SECTIONS = Object.keys(DASHBOARD_CONFIG.nav.admin) as Section[];
const ICON = { today: "sun", leads: "inbox", people: "people", batches: "layers", help: "help" } as const;
const home = DASHBOARD_CONFIG.home;

/** Old links and notifications name a tab, e.g. /admin?tab=help or ?tab=teachers. */
const fromQuery = (q: URLSearchParams): Section | null => {
  const t = q.get("tab");
  if (t === "students" || t === "teachers" || t === "team") return "people";
  return t && t in DASHBOARD_CONFIG.nav.admin ? (t as Section) : null;
};
const startPeople = (): People => {
  const t = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("tab");
  return t === "teachers" || t === "team" ? t : "students";
};

function Admin({ session }: { session: Session }) {
  const [section, go, href] = useSection("/admin", SECTIONS, fromQuery);
  const [people, setPeople] = useState<People>(startPeople);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [leads, students, teachers, batches, team, progress, help] = await Promise.all([
        listAll.leads(),
        listAll.students(),
        listAll.teachers(),
        listAll.batches(),
        listAll.team(),
        allProgress(),
        // Help requests are new; a project without their rules yet still opens the rest of the page.
        listHelp().catch(() => []),
      ]);
      setData({ leads, students, teachers, batches, team, progress, help });
      setError(null);
    } catch {
      setError("Couldn't load the records. Please check the internet connection and refresh.");
    }
  }, []);
  useEffect(() => void reload(), [reload]);

  /** Runs a change, then reloads. Cloud Functions update rosters a moment later, so reload once more. */
  const act = async (task: () => Promise<unknown>) => {
    try {
      await task();
      await reload();
      setTimeout(() => void reload(), 2500);
      return true;
    } catch (e) {
      setError(
        e instanceof DuplicateRecord
          ? e.kind === "teachers"
            ? "That change wasn't saved: another teacher already has this mobile number."
            : "That change wasn't saved: this child is already on the list with the same parent's number."
          : "That change wasn't saved. Please check every field and try again.",
      );
      return false;
    }
  };

  const openHelp = data?.help.filter((h) => h.status === "open").length ?? 0;
  const newLeads = data?.leads.filter((l) => l.status === "new").length ?? 0;
  const nav: Nav<Section> = {
    items: SECTIONS.map((key) => ({
      key,
      label: DASHBOARD_CONFIG.nav.admin[key],
      icon: ICON[key],
      badge: key === "help" ? openHelp : key === "leads" ? newLeads : 0,
    })),
    active: section,
    go,
    href,
  };
  const title = {
    today: "Stoodant team",
    leads: copy.tabs.leads,
    people: DASHBOARD_CONFIG.nav.admin.people,
    batches: copy.tabs.batches,
    help: copy.tabs.help,
  }[section];

  return (
    <Shell role="Team" onSignOut={signOut} nav={nav}>
      <section className="pd-child">
        {section === "today" && <p className="pd-hello">{session.user.email}</p>}
        <h1>{title}</h1>
      </section>
      {section === "people" && (
        <div className="pd-tabs" role="tablist" aria-label="People">
          {(Object.keys(home.peopleTabs) as People[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={people === t}
              onClick={() => setPeople(t)}
            >
              {home.peopleTabs[t]}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="pd-alert" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}
      {!data ? (
        <Loading />
      ) : (
        <div>
          {section === "today" && (
            <TeamToday data={data} go={go} openPeople={(p) => (setPeople(p), go("people"))} />
          )}
          {section === "leads" && <Leads leads={data.leads} act={act} uid={session.user.uid} />}
          {section === "people" && people === "students" && <Students data={data} act={act} />}
          {section === "people" && people === "teachers" && <Teachers data={data} act={act} />}
          {section === "people" && people === "team" && (
            <Team data={data} act={act} me={session.user.email ?? ""} />
          )}
          {section === "batches" && <Batches data={data} act={act} />}
          {section === "help" && <Help help={data.help} act={act} uid={session.user.uid} />}
        </div>
      )}
    </Shell>
  );
}

/** The team's morning check: what needs a call back, who needs help, which classes run today. */
function TeamToday({
  data,
  go,
  openPeople,
}: {
  data: Data;
  go: (s: Section) => void;
  openPeople: (p: People) => void;
}) {
  const [classes, setClasses] = useState<LiveClass[] | null>(null);
  const [failed, setFailed] = useState(false);
  const today = istDay();
  const ids = useMemo(
    () => data.batches.filter((b) => b.active !== false).map((b) => b.id).join(","),
    [data.batches],
  );
  useEffect(() => {
    let live = true;
    const from = Date.parse(istIso(today, "00:00"));
    const to = Date.parse(istIso(today, "23:59"));
    classesFor(ids ? ids.split(",") : [], from)
      .then((list) => live && setClasses(list.filter((c) => c.startAt <= to)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [ids, today]);

  const newLeads = data.leads.filter((l) => l.status === "new").length;
  const openLeads = data.leads.filter((l) => !["enrolled", "closed"].includes(l.status)).length;
  const openHelp = data.help.filter((h) => h.status === "open").length;
  const running = classes?.filter((c) => c.status === "scheduled") ?? [];
  const batches = data.batches.filter((b) => b.active !== false).length;
  const activeStudents = data.students.filter((s) => s.active).length;
  const now = Date.now();

  return (
    <>
      <section className="pd-section" aria-labelledby="pd-team-today">
        <h2 id="pd-team-today">{home.teamToday}</h2>
        <div className="pd-tiles">
          <Tile
            label={home.newDemos}
            value={String(newLeads)}
            hint={`${openLeads} open in total`}
            tone={newLeads ? "alert" : undefined}
            onClick={() => go("leads")}
          />
          <Tile
            label={home.openHelp}
            value={String(openHelp)}
            hint={openHelp ? "Call them back" : "Nobody waiting"}
            tone={openHelp ? "alert" : undefined}
            onClick={() => go("help")}
          />
          <Tile
            label={home.classesToday}
            value={classes ? String(running.length) : "…"}
            hint={failed ? "Couldn't load" : `${batches} running ${batches === 1 ? "batch" : "batches"}`}
            onClick={() => go("batches")}
          />
          <Tile
            label={home.activeStudents}
            value={String(activeStudents)}
            hint={`${data.teachers.filter((t) => t.active !== false).length} teachers`}
            onClick={() => openPeople("students")}
          />
        </div>
      </section>

      {running.length > 0 && (
        <section className="pd-section" aria-labelledby="pd-team-classes">
          <h2 id="pd-team-classes">{home.classesToday}</h2>
          <ul className="pd-todo">
            {running.map((c) => (
              <li key={c.id}>
                <a className="pd-todo-row" href={`/teacher?batch=${c.batchId}&class=${c.id}`}>
                  <span className="pd-todo-mark" aria-hidden="true">
                    ●
                  </span>
                  <span>
                    {time12(c.startAt)} · {c.batchName}
                    <small>
                      {c.teacherName} · {statusLine(c, now)}
                    </small>
                  </span>
                  <span className="pd-todo-go" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pd-section" aria-labelledby="pd-team-month">
        <h2 id="pd-team-month">{home.month}</h2>
        <Overview data={data} />
      </section>
    </>
  );
}

type Act = (task: () => Promise<unknown>) => Promise<boolean>;
const local = (phone: string) => phone.replace(/^\+91/, "");
const when = (lead: Lead) =>
  lead.createdAt?.toDate().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }) ?? "";

// ---- Demo requests ----

function Leads({ leads, act, uid }: { leads: Lead[]; act: Act; uid: string }) {
  const [filter, setFilter] = useState<string>("open");
  const shown = leads.filter((l) =>
    filter === "open" ? !["enrolled", "closed"].includes(l.status) : true,
  );
  return (
    <>
      <div className="pd-picker" role="group" aria-label="Show">
        {[
          ["open", "Open"],
          ["all", "All"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key!)}
          >
            {label}
          </button>
        ))}
      </div>
      {!shown.length && <p className="pd-empty">No demo requests here yet.</p>}
      <ul className="pd-list">
        {shown.map((lead) => (
          <LeadItem key={lead.id} lead={lead} act={act} uid={uid} />
        ))}
      </ul>
    </>
  );
}

function LeadItem({ lead, act, uid }: { lead: Lead; act: Act; uid: string }) {
  const [note, setNote] = useState("");
  const wa = `https://wa.me/${lead.parentPhoneE164.replace("+", "")}?text=${encodeURIComponent(`Hi ${lead.parentName}, this is Stoodant about your free demo class.`)}`;
  return (
    <li className="pd-item">
      <div className="pd-item-head">
        <strong>{lead.parentName}</strong>
        <select
          className="pd-select-sm"
          aria-label="Status"
          value={lead.status}
          onChange={(e) => void act(() => setLeadStatus(lead.id, e.target.value))}
        >
          {Object.entries(copy.leadStatus).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <span>
        Class {lead.studentClass} · {lead.board} · {when(lead)}
      </span>
      <div className="pd-actions">
        <a className="pd-link" href={`tel:${lead.parentPhoneE164}`}>
          Call {lead.parentPhoneE164}
        </a>
        <a className="pd-link" href={wa} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
        <button
          type="button"
          className="pd-link"
          onClick={() =>
            confirmDelete(`the demo request from ${lead.parentName}`) &&
            void act(() => deleteLead(lead.id))
          }
        >
          Delete
        </button>
      </div>
      <form
        className="pd-actions"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            note.trim() &&
            (await act(() => addLeadNote(lead.id, note.trim().slice(0, 2000), uid)))
          )
            setNote("");
        }}
      >
        <input
          className="pd-select-sm"
          style={{ flex: 1 }}
          aria-label="Add a note"
          placeholder="Add a note (only the team sees it)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="submit" className="pd-link" disabled={!note.trim()}>
          Save note
        </button>
      </form>
    </li>
  );
}

// ---- Shared editing pieces ----

function Editor({
  title,
  onCancel,
  onSave,
  children,
  valid,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
  valid: boolean;
}) {
  return (
    <form
      className="pd-card pd-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave();
      }}
    >
      <h2>{title}</h2>
      {children}
      <button type="submit" className="pd-save" disabled={!valid}>
        Save
      </button>
      <button type="button" className="pd-link" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function Text({
  label,
  value,
  onChange,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <label className="pd-field">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (string | [string, string])[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="pd-field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="pd-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function ItemActions({
  onEdit,
  onDelete,
  extra,
}: {
  onEdit: () => void;
  onDelete: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="pd-actions">
      <button type="button" className="pd-link" onClick={onEdit}>
        Edit
      </button>
      {extra}
      <button type="button" className="pd-link" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

/** Reads the number back in groups, so a mistyped digit is easy to spot before saving. */
function PhoneCheck({ phone }: { phone: string | null }) {
  if (!phone) return null;
  return (
    <p className="pd-phone-check">
      {copy.phoneCheck}{" "}
      <strong>
        +91 {phone.slice(3, 8)} {phone.slice(8)}
      </strong>
    </p>
  );
}

/** 15 to 300 minutes; anything else falls back to an hour. */
const classMinutes = (text: string) => {
  const n = Number(text);
  return Number.isInteger(n) && n >= 15 && n <= 300 ? n : 60;
};

const confirmDelete = (what: string) => window.confirm(`Delete ${what}? This can't be undone.`);

// ---- Students ----

type StudentForm = Omit<Student, "id" | "parentPhone"> & { parentPhone: string };
const blankStudent: StudentForm = {
  name: "",
  classLevel: "7",
  board: "CBSE",
  parentName: "",
  parentPhone: "",
  batchIds: [],
  whatsappOptIn: true,
  active: true,
};

type StudentFilter = {
  q: string;
  classLevel: string;
  batch: string;
  show: "active" | "inactive" | "all";
};
type Numbers = { attendance: number | null; held: number; average: number | null; tests: number };

/** Attendance and test average over the last 30 days, from each child's progress page. */
function usePerformance(progress: Progress[]) {
  return useMemo(() => {
    const period = { from: istDay(-29), to: istDay() };
    return new Map<string, Numbers>(
      progress.map((p) => {
        const o = overview(p, period);
        return [
          p.student.id,
          {
            attendance: o.attendance.percent,
            held: o.attendance.held,
            average: o.average,
            tests: o.tests.filter((t) => t.percent != null).length,
          },
        ];
      }),
    );
  }, [progress]);
}

function Performance({ numbers }: { numbers: Numbers | undefined }) {
  if (!numbers || (!numbers.held && !numbers.tests))
    return <span className="pd-muted">No classes or tests in the last 30 days.</span>;
  return (
    <dl className="pd-class-nums">
      <div>
        <dt>Attendance</dt>
        <dd>{numbers.attendance == null ? "–" : `${numbers.attendance}%`}</dd>
      </div>
      <div>
        <dt>Classes</dt>
        <dd>{numbers.held}</dd>
      </div>
      <div>
        <dt>Test average</dt>
        <dd>{numbers.average == null ? "–" : `${numbers.average}%`}</dd>
      </div>
    </dl>
  );
}

function Students({ data, act }: { data: Data; act: Act }) {
  const [editing, setEditing] = useState<{ id: string | null; form: StudentForm } | null>(null);
  const [filter, setFilter] = useState<StudentFilter>({
    q: "",
    classLevel: "",
    batch: "",
    show: "active",
  });
  const performance = usePerformance(data.progress);
  const batchName = (id: string) => data.batches.find((b) => b.id === id)?.name ?? "Removed batch";
  if (editing) {
    const { form } = editing;
    const set = (patch: Partial<StudentForm>) =>
      setEditing({ ...editing, form: { ...form, ...patch } });
    const phone = indianMobile(form.parentPhone);
    return (
      <Editor
        title={editing.id ? "Edit student" : "Add a student"}
        valid={Boolean(form.name.trim() && form.parentName.trim() && phone)}
        onCancel={() => setEditing(null)}
        onSave={async () => {
          const fields = {
            ...form,
            name: form.name.trim(),
            parentName: form.parentName.trim(),
            parentPhone: phone,
          };
          if (await act(() => saveRecord("students", editing.id, fields))) setEditing(null);
        }}
      >
        <Text
          label="Child's name"
          value={form.name}
          maxLength={80}
          onChange={(name) => set({ name })}
        />
        <div className="pd-grid">
          <Choice
            label="Class"
            value={form.classLevel}
            options={CLASSES}
            onChange={(classLevel) => set({ classLevel })}
          />
          <Choice
            label="Board"
            value={form.board}
            options={BOARDS}
            onChange={(board) => set({ board: board as Student["board"] })}
          />
        </div>
        <Text
          label="Parent's name"
          value={form.parentName}
          maxLength={80}
          onChange={(parentName) => set({ parentName })}
        />
        <Text
          label="Parent's mobile (they log in with this)"
          type="tel"
          inputMode="numeric"
          value={form.parentPhone}
          onChange={(parentPhone) => set({ parentPhone })}
          placeholder="98765 43210"
        />
        <PhoneCheck phone={phone} />
        <fieldset className="pd-stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="pd-field">Batches</legend>
          {data.batches.length ? (
            data.batches.map((b) => (
              <Check
                key={b.id}
                label={b.name}
                checked={form.batchIds.includes(b.id)}
                onChange={(on) =>
                  set({
                    batchIds: on
                      ? [...form.batchIds, b.id]
                      : form.batchIds.filter((id) => id !== b.id),
                  })
                }
              />
            ))
          ) : (
            <p className="pd-muted">Add a batch first.</p>
          )}
        </fieldset>
        <Check
          label="Send weekly reports on WhatsApp"
          checked={form.whatsappOptIn}
          onChange={(whatsappOptIn) => set({ whatsappOptIn })}
        />
        <Check
          label="Currently studying with us"
          checked={form.active}
          onChange={(active) => set({ active })}
        />
      </Editor>
    );
  }
  const shown = data.students.filter(
    (s) =>
      (!filter.q || s.name.toLowerCase().includes(filter.q.trim().toLowerCase())) &&
      (!filter.classLevel || s.classLevel === filter.classLevel) &&
      (!filter.batch || s.batchIds.includes(filter.batch)) &&
      (filter.show === "all" || s.active === (filter.show === "active")),
  );
  return (
    <>
      <button
        type="button"
        className="pd-save"
        onClick={() => setEditing({ id: null, form: blankStudent })}
      >
        Add a student
      </button>
      {data.students.length > 0 && (
        <div className="pd-filters" role="search" aria-label="Find students">
          <Text
            label="Search by name"
            type="search"
            value={filter.q}
            onChange={(q) => setFilter({ ...filter, q })}
            placeholder="Child's name"
          />
          <div className="pd-grid pd-grid-3">
            <Choice
              label="Class"
              value={filter.classLevel}
              options={[
                ["", "All classes"],
                ...CLASSES.map((c): [string, string] => [c, `Class ${c}`]),
              ]}
              onChange={(classLevel) => setFilter({ ...filter, classLevel })}
            />
            <Choice
              label="Batch"
              value={filter.batch}
              options={[
                ["", "All batches"],
                ...data.batches.map((b): [string, string] => [b.id, b.name]),
              ]}
              onChange={(batch) => setFilter({ ...filter, batch })}
            />
            <Choice
              label="Show"
              value={filter.show}
              options={[
                ["active", "Studying now"],
                ["inactive", "Left"],
                ["all", "Everyone"],
              ]}
              onChange={(show) => setFilter({ ...filter, show: show as StudentFilter["show"] })}
            />
          </div>
          <p className="pd-muted" aria-live="polite">
            {shown.length} of {data.students.length} students · attendance and marks from the last
            30 days
          </p>
        </div>
      )}
      {!data.students.length && <p className="pd-empty">No students yet.</p>}
      {data.students.length > 0 && !shown.length && (
        <p className="pd-empty">No students match. Try clearing the search or filters.</p>
      )}
      <ul className="pd-list">
        {shown.map((s) => (
          <li key={s.id} className={`pd-item${s.active ? "" : " is-off"}`}>
            <div className="pd-item-head">
              <strong>{s.name}</strong>
              <span>
                Class {s.classLevel} · {s.board}
              </span>
            </div>
            <span>
              {s.parentName} · {s.parentPhone}
            </span>
            <span className="pd-muted">
              {s.batchIds.length ? s.batchIds.map(batchName).join(", ") : "Not in a batch yet"}
            </span>
            <Performance numbers={performance.get(s.id)} />
            <ItemActions
              onEdit={() =>
                setEditing({
                  id: s.id,
                  form: { ...blankStudent, ...s, parentPhone: local(s.parentPhone) },
                })
              }
              onDelete={() =>
                confirmDelete(`${s.name} and their progress page`) &&
                void act(() => deleteRecord("students", s.id))
              }
              extra={
                <a className="pd-link" href={`/parent?student=${s.id}`}>
                  Parent's view
                </a>
              }
            />
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- Teachers ----

type TeacherForm = { name: string; phone: string; subjects: string; active: boolean };

function Teachers({ data, act }: { data: Data; act: Act }) {
  const [editing, setEditing] = useState<{ id: string | null; form: TeacherForm } | null>(null);
  if (editing) {
    const { form } = editing;
    const set = (patch: Partial<TeacherForm>) =>
      setEditing({ ...editing, form: { ...form, ...patch } });
    const phone = indianMobile(form.phone);
    return (
      <Editor
        title={editing.id ? "Edit teacher" : "Add a teacher"}
        valid={Boolean(form.name.trim() && phone)}
        onCancel={() => setEditing(null)}
        onSave={async () => {
          const subjects = form.subjects
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 10);
          const fields = { name: form.name.trim(), phone, subjects, active: form.active };
          if (await act(() => saveRecord("teachers", editing.id, fields))) setEditing(null);
        }}
      >
        <Text
          label="Name parents see"
          value={form.name}
          maxLength={80}
          onChange={(name) => set({ name })}
          placeholder="Priya Ma'am"
        />
        <Text
          label="Mobile (they log in with this)"
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={(phone) => set({ phone })}
          placeholder="98765 43210"
        />
        <PhoneCheck phone={phone} />
        <Text
          label="Subjects, separated by commas"
          value={form.subjects}
          onChange={(subjects) => set({ subjects })}
          placeholder="Maths, Science"
        />
        <Check
          label="Teaching now (untick to remove their access)"
          checked={form.active}
          onChange={(active) => set({ active })}
        />
      </Editor>
    );
  }
  return (
    <>
      <button
        type="button"
        className="pd-save"
        onClick={() =>
          setEditing({ id: null, form: { name: "", phone: "", subjects: "", active: true } })
        }
      >
        Add a teacher
      </button>
      {!data.teachers.length && <p className="pd-empty">No teachers yet.</p>}
      <ul className="pd-list">
        {data.teachers.map((t) => (
          <li key={t.id} className={`pd-item${t.active ? "" : " is-off"}`}>
            <div className="pd-item-head">
              <strong>{t.name}</strong>
              <span>{t.phone}</span>
            </div>
            <span className="pd-muted">
              {t.subjects.join(", ") || "No subjects listed"} ·{" "}
              {data.batches.filter((b) => b.teacherId === t.id).length} batches
            </span>
            <ItemActions
              onEdit={() =>
                setEditing({
                  id: t.id,
                  form: {
                    name: t.name,
                    phone: local(t.phone),
                    subjects: t.subjects.join(", "),
                    active: t.active,
                  },
                })
              }
              onDelete={() =>
                confirmDelete(t.name) && void act(() => deleteRecord("teachers", t.id))
              }
            />
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- Batches ----

type BatchForm = Pick<
  Batch,
  "name" | "classLevel" | "board" | "subject" | "teacherId" | "schedule" | "active"
> & { minutes: string };

function Batches({ data, act }: { data: Data; act: Act }) {
  const [editing, setEditing] = useState<{ id: string | null; form: BatchForm } | null>(null);
  const teacherName = (id: string) =>
    data.teachers.find((t) => t.id === id)?.name ?? "No teacher yet";
  if (editing) {
    const { form } = editing;
    const set = (patch: Partial<BatchForm>) =>
      setEditing({ ...editing, form: { ...form, ...patch } });
    return (
      <Editor
        title={editing.id ? "Edit batch" : "Add a batch"}
        valid={Boolean(form.name.trim() && form.subject.trim())}
        onCancel={() => setEditing(null)}
        onSave={async () => {
          const { minutes, ...rest } = form;
          const fields = {
            ...rest,
            name: form.name.trim(),
            subject: form.subject.trim(),
            schedule: form.schedule.trim().slice(0, 120),
            durationMinutes: classMinutes(minutes),
          };
          if (await act(() => saveRecord("batches", editing.id, fields))) setEditing(null);
        }}
      >
        <Text
          label="Batch name"
          value={form.name}
          maxLength={80}
          onChange={(name) => set({ name })}
          placeholder="Class 7 CBSE · Maths"
        />
        <div className="pd-grid">
          <Choice
            label="Class"
            value={form.classLevel}
            options={CLASSES}
            onChange={(classLevel) => set({ classLevel })}
          />
          <Choice
            label="Board"
            value={form.board}
            options={BOARDS}
            onChange={(board) => set({ board: board as Batch["board"] })}
          />
        </div>
        <Text
          label="Subject"
          value={form.subject}
          maxLength={40}
          onChange={(subject) => set({ subject })}
          placeholder="Maths"
        />
        <Choice
          label="Teacher"
          value={form.teacherId}
          options={[
            ["", "Choose later"],
            ...data.teachers.filter((t) => t.active).map((t) => [t.id, t.name] as [string, string]),
          ]}
          onChange={(teacherId) => set({ teacherId })}
        />
        <Text
          label="Schedule"
          value={form.schedule}
          maxLength={120}
          onChange={(schedule) => set({ schedule })}
          placeholder="Mon, Wed, Fri · 5:00 pm"
        />
        <Text
          label="Length of one class (minutes, for the hours report)"
          inputMode="numeric"
          value={form.minutes}
          onChange={(m) => set({ minutes: m.replace(/\D/g, "").slice(0, 3) })}
          placeholder="60"
        />
        <Check label="Running now" checked={form.active} onChange={(active) => set({ active })} />
      </Editor>
    );
  }
  const blank: BatchForm = {
    name: "",
    classLevel: "7",
    board: "CBSE",
    subject: "",
    teacherId: "",
    schedule: "",
    active: true,
    minutes: "60",
  };
  return (
    <>
      <button
        type="button"
        className="pd-save"
        onClick={() => setEditing({ id: null, form: blank })}
      >
        Add a batch
      </button>
      {!data.batches.length && <p className="pd-empty">No batches yet.</p>}
      <ul className="pd-list">
        {data.batches.map((b) => (
          <li key={b.id} className={`pd-item${b.active ? "" : " is-off"}`}>
            <div className="pd-item-head">
              <strong>{b.name}</strong>
              <span>{b.subject}</span>
            </div>
            <span>
              {teacherName(b.teacherId)} · {b.schedule || "No schedule yet"} ·{" "}
              {b.durationMinutes ?? 60} min
            </span>
            <span className="pd-muted">
              {b.roster?.length ? b.roster.map((s) => s.name).join(", ") : "No students yet"}
            </span>
            <ItemActions
              onEdit={() =>
                setEditing({
                  id: b.id,
                  form: {
                    name: b.name,
                    classLevel: b.classLevel,
                    board: b.board,
                    subject: b.subject,
                    teacherId: b.teacherId,
                    schedule: b.schedule,
                    active: b.active,
                    minutes: String(b.durationMinutes ?? 60),
                  },
                })
              }
              onDelete={() =>
                confirmDelete(b.name) && void act(() => deleteRecord("batches", b.id))
              }
              extra={
                <a className="pd-link" href={`/teacher?batch=${b.id}`}>
                  Teacher's page
                </a>
              }
            />
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- Team access ----

function Team({ data, act, me }: { data: Data; act: Act; me: string }) {
  const [email, setEmail] = useState("");
  const clean = email.trim().toLowerCase();
  const valid = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(clean);
  const already = data.team.some((m) => m.id === clean);
  return (
    <>
      <p className="pd-hint">{copy.teamIntro}</p>
      <form
        className="pd-card pd-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (valid && !already && (await act(() => addTeamMember(clean, me)))) setEmail("");
        }}
      >
        <Text
          label={copy.teamEmailLabel}
          type="email"
          autoComplete="off"
          value={email}
          onChange={setEmail}
          placeholder="name@gmail.com"
        />
        {already && <p className="pd-muted">This address is already on the list.</p>}
        <button type="submit" className="pd-save" disabled={!valid || already}>
          {copy.teamAdd}
        </button>
      </form>
      {!data.team.length && <p className="pd-empty">{copy.teamEmpty}</p>}
      <ul className="pd-list">
        {data.team.map((m) => (
          <li key={m.id} className="pd-item">
            <div className="pd-item-head">
              <strong>{m.id}</strong>
              {m.id === me.toLowerCase() && <span>{copy.teamYou}</span>}
            </div>
            <span className="pd-muted">Added by {m.addedBy}</span>
            {m.id !== me.toLowerCase() && (
              <div className="pd-actions">
                <button
                  type="button"
                  className="pd-link"
                  onClick={() =>
                    window.confirm(`Remove ${m.id}? They lose access straight away.`) &&
                    void act(() => removeTeamMember(m.id))
                  }
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="pd-muted">{copy.teamOwners}</p>
    </>
  );
}

function Help({ help, act, uid }: { help: HelpRequest[]; act: Act; uid: string }) {
  if (!help.length) return <p className="pd-empty">{copy.helpEmpty}</p>;
  const topics = DASHBOARD_CONFIG.help.topics;
  return (
    <ul className="pd-list">
      {help.map((h) => (
        <li key={h.id} className="pd-item" data-done={h.status === "done" || undefined}>
          <div className="pd-item-head">
            <strong>
              {copy.helpRoles[h.role] ?? copy.helpRoles.unknown} {h.role === "unknown" || !h.name ? h.phone : h.name}
            </strong>
            <span>{h.status === "done" ? copy.helpDone : copy.helpOpen}</span>
          </div>
          <span className="pd-muted">
            {topics[h.topic] ?? h.topic}
            {h.createdAt && ` · ${h.createdAt.toDate().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
          </span>
          <p className="pd-help-msg">{h.message}</p>
          <div className="pd-actions">
            <a className="pd-link" href={`tel:${h.phone}`}>
              Call {h.phone}
            </a>
            <a className="pd-link" href={`https://wa.me/${h.phone.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            {h.status === "open" && (
              <button type="button" className="pd-link" onClick={() => void act(() => closeHelp(h.id, uid))}>
                {copy.helpClose}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
