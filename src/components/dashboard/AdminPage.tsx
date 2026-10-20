import { useCallback, useEffect, useState, type ReactNode } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import {
  addLeadNote,
  deleteRecord,
  listAll,
  saveRecord,
  setLeadStatus,
  type Batch,
  type Lead,
  type Student,
  type Teacher,
} from "@/lib/firebase/school";
import { indianMobile, signOutNow, useSession, type Session } from "@/lib/firebase/session";
import { Loading, RequireLogin, Shell } from "./Shell";

const copy = DASHBOARD_CONFIG.admin;
type Tab = keyof typeof copy.tabs;
const CLASSES = ["4", "5", "6", "7", "8", "9", "10"];
const BOARDS = ["CBSE", "ICSE"] as const;
const signOut = () => void signOutNow().then(() => location.assign("/login"));

/** The team's page: demo requests, and the students, teachers and batches that the other pages run on. */
export function AdminPage() {
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

type Data = { leads: Lead[]; students: Student[]; teachers: Teacher[]; batches: Batch[] };

function Admin({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("leads");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [leads, students, teachers, batches] = await Promise.all([
        listAll.leads(),
        listAll.students(),
        listAll.teachers(),
        listAll.batches(),
      ]);
      setData({ leads, students, teachers, batches });
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
    } catch {
      setError("That change wasn't saved. Please check every field and try again.");
      return false;
    }
  };

  return (
    <Shell role="Team" onSignOut={signOut}>
      <section className="pd-child">
        <h1>Stoodant team</h1>
        <p>{session.user.email}</p>
      </section>
      <div className="pd-tabs" role="tablist" aria-label="Records">
        {(Object.keys(copy.tabs) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {copy.tabs[t]}
          </button>
        ))}
      </div>
      {error && (
        <p className="pd-alert" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}
      {!data ? (
        <Loading />
      ) : (
        <div role="tabpanel">
          {tab === "leads" && <Leads leads={data.leads} act={act} uid={session.user.uid} />}
          {tab === "students" && <Students data={data} act={act} />}
          {tab === "teachers" && <Teachers data={data} act={act} />}
          {tab === "batches" && <Batches data={data} act={act} />}
        </div>
      )}
    </Shell>
  );
}

type Act = (task: () => Promise<unknown>) => Promise<boolean>;
const local = (phone: string) => phone.replace(/^\+91/, "");
const when = (lead: Lead) =>
  lead.createdAt
    ?.toDate()
    .toLocaleString("en-IN", {
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

function Students({ data, act }: { data: Data; act: Act }) {
  const [editing, setEditing] = useState<{ id: string | null; form: StudentForm } | null>(null);
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
  return (
    <>
      <button
        type="button"
        className="pd-save"
        onClick={() => setEditing({ id: null, form: blankStudent })}
      >
        Add a student
      </button>
      {!data.students.length && <p className="pd-empty">No students yet.</p>}
      <ul className="pd-list">
        {data.students.map((s) => (
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
>;

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
          const fields = {
            ...form,
            name: form.name.trim(),
            subject: form.subject.trim(),
            schedule: form.schedule.trim().slice(0, 120),
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
              {teacherName(b.teacherId)} · {b.schedule || "No schedule yet"}
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
                  },
                })
              }
              onDelete={() =>
                confirmDelete(b.name) && void act(() => deleteRecord("batches", b.id))
              }
            />
          </li>
        ))}
      </ul>
    </>
  );
}
