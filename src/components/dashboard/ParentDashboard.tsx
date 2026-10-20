import { useEffect, useState, type ReactNode } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { SITE_CONFIG } from "@/config/siteConfig";
import type { Material } from "@/lib/firebase/materials";
import {
  attendanceSummary,
  formatDay,
  formatMonth,
  monthOf,
  overview,
  previousPeriod,
  testTimeline,
  weekOf,
  weeklyAttendance,
  type Overview,
  type Period,
  type StudentRecords,
  type SubjectSummary,
  type Trend,
} from "@/lib/progress/insights";
import { monthlyReport, weeklyReport } from "@/lib/progress/reportText";
import { AttendanceChart, MarksChart } from "./Charts";
import { MaterialList } from "./MaterialList";
import { Shell } from "./Shell";

const copy = DASHBOARD_CONFIG.parent;
const { attendanceGood, attendanceWatch } = DASHBOARD_CONFIG.insights;
type PeriodKind = "week" | "month";

/** The parent's view of one child: the signed-in parent's progress page, or sample records as a preview. */
export function ParentDashboard({
  records,
  today,
  sample = false,
  picker,
  onSignOut,
  materials,
}: {
  records: StudentRecords;
  today: string;
  sample?: boolean;
  picker?: ReactNode | undefined;
  onSignOut?: (() => void) | undefined;
  /** Study material the child's teachers shared. Without `open`, the list is a preview. */
  materials?:
    | {
        load: () => Promise<Material[]>;
        open?: ((m: Material) => Promise<string>) | undefined;
      }
    | undefined;
}) {
  const [kind, setKind] = useState<PeriodKind>("week");
  const period = kind === "week" ? weekOf(today) : monthOf(today);
  const data = overview(records, period);
  const report = kind === "week" ? weeklyReport(records, today) : monthlyReport(records, today);
  const { student } = records;
  const periodLabel =
    kind === "week"
      ? `${formatDay(period.from)} to ${formatDay(period.to)}`
      : formatMonth(period.from);
  const waText = encodeURIComponent(
    `Hi Stoodant, I have a question about ${student.name}'s progress.`,
  );

  return (
    <Shell role="Parent" onSignOut={onSignOut}>
      {sample && <p className="pd-banner">{copy.sampleBanner}</p>}
      {picker}

      <section className="pd-child" aria-labelledby="pd-child-name">
        <h1 id="pd-child-name">{student.name}</h1>
        <p>
          Class {student.classLevel} · {student.board} · {student.batch}
        </p>
      </section>

      <div className="pd-toggle" role="group" aria-label="Period">
        {(["week", "month"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === "week" ? copy.periodWeek : copy.periodMonth}
          </button>
        ))}
      </div>
      <p className="pd-period">{periodLabel}</p>

      <section className="pd-stats" aria-label="Summary">
        <Stat
          label={copy.attendance}
          value={data.attendance.percent == null ? "–" : `${data.attendance.percent}%`}
          hint={attendanceHint(data)}
          tone={attendanceTone(data.attendance.percent)}
        />
        <Stat
          label={copy.average}
          value={data.average == null ? "–" : `${data.average}%`}
          hint={
            data.tests.length
              ? `${data.tests.filter((t) => t.percent != null).length} tests`
              : copy.noTests
          }
        />
        <Stat
          label={copy.improvement}
          value={data.delta == null ? "–" : `${data.delta > 0 ? "+" : ""}${data.delta}`}
          hint={
            data.delta == null ? DASHBOARD_CONFIG.trendLabels.unknown : "points vs earlier tests"
          }
          tone={data.trend === "up" ? "good" : undefined}
        />
      </section>

      <p className="pd-summary">{summarySentence(student.name, data)}</p>

      <Improvements records={records} data={data} period={period} kind={kind} />
      <Charts records={records} today={today} />

      <section className="pd-section" aria-labelledby="pd-subjects">
        <h2 id="pd-subjects">{copy.subjects}</h2>
        <ul className="pd-subjects">
          {data.subjects.map((s) => (
            <SubjectRow key={s.subject} s={s} focus={data.focus?.subject === s.subject} />
          ))}
        </ul>
      </section>

      <section className="pd-section" aria-labelledby="pd-classes">
        <h2 id="pd-classes">{copy.classes}</h2>
        <ClassStrip records={records} from={period.from} to={period.to} />
      </section>

      <section className="pd-section" aria-labelledby="pd-tests">
        <h2 id="pd-tests">{copy.tests}</h2>
        {data.tests.length ? (
          <ul className="pd-tests">
            {data.tests.map((t) => (
              <li key={`${t.date}-${t.subject}-${t.title}`}>
                <span>
                  <strong>{t.title}</strong>
                  <small>
                    {t.subject} · {formatDay(t.date)}
                  </small>
                </span>
                <span className="pd-score">
                  {t.score == null ? copy.absent : `${t.score}/${t.max}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pd-empty">{copy.noTests}</p>
        )}
      </section>

      {data.notes.length > 0 && (
        <section className="pd-section" aria-labelledby="pd-notes">
          <h2 id="pd-notes">{copy.teacherNote}</h2>
          {data.notes.map((n) => (
            <blockquote key={`${n.date}-${n.subject}`} className="pd-note">
              <p>{n.lines.join(". ")}.</p>
              <p className="pd-note-by">
                {n.teacher}, {n.subject} · {formatDay(n.date)}
              </p>
            </blockquote>
          ))}
        </section>
      )}

      {materials && <StudyMaterial {...materials} />}

      <section className="pd-section" aria-labelledby="pd-report">
        <h2 id="pd-report">{copy.reportTitle}</h2>
        <p className="pd-muted">{kind === "week" ? copy.reportWeekNote : copy.reportMonthNote}</p>
        <div className="pd-chat">
          <WhatsAppText text={report} />
        </div>
      </section>

      <a
        className="pd-cta"
        href={`https://wa.me/${SITE_CONFIG.contact.whatsapp}?text=${waText}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {copy.askTeacher}
      </a>
    </Shell>
  );
}

function StudyMaterial({
  load,
  open,
}: {
  load: () => Promise<Material[]>;
  open?: ((m: Material) => Promise<string>) | undefined;
}) {
  const [items, setItems] = useState<Material[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    load()
      .then((m) => live && setItems(m))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [load]);
  return (
    <section className="pd-section" aria-labelledby="pd-materials">
      <h2 id="pd-materials">{copy.materialsTitle}</h2>
      <p className="pd-muted">{copy.materialsNote}</p>
      {failed && <p className="pd-alert">{copy.materialsFailed}</p>}
      {!items && !failed && <p className="pd-muted">Loading…</p>}
      {items && !items.length && <p className="pd-empty">{copy.materialsEmpty}</p>}
      {items && items.length > 0 && (
        <MaterialList
          items={items}
          open={open}
          openError={open ? undefined : copy.materialsPreview}
        />
      )}
    </section>
  );
}

/** What moved, in plain words: attendance against the period before, subjects going up or down, the best test. */
function Improvements({
  records,
  data,
  period,
  kind,
}: {
  records: StudentRecords;
  data: Overview;
  period: Period;
  kind: PeriodKind;
}) {
  const items: { mark: string; text: string }[] = [];
  const before = attendanceSummary(records.attendance, previousPeriod(period, kind)).percent;
  const now = data.attendance.percent;
  const last = kind === "week" ? "last week" : "last month";
  if (now != null && before != null) {
    if (now > before)
      items.push({ mark: "↑", text: `Attendance ${now}%, up from ${before}% ${last}` });
    else if (now < before)
      items.push({ mark: "↓", text: `Attendance ${now}%, a little lower than ${before}% ${last}` });
    else items.push({ mark: "=", text: `Attendance ${now}%, the same as ${last}` });
  }
  for (const s of data.subjects) {
    if (s.trend === "up" && s.delta != null)
      items.push({
        mark: "↑",
        text: `${s.subject}: up ${s.delta} points compared with earlier tests`,
      });
    if (s.trend === "down" && s.delta != null)
      items.push({
        mark: "↓",
        text: `${s.subject} needs a little focus: ${Math.abs(s.delta)} points lower than earlier tests`,
      });
  }
  const best = data.tests
    .filter((t) => t.percent != null)
    .sort((a, b) => (b.percent as number) - (a.percent as number))[0];
  if (best)
    items.push({ mark: "★", text: `Best test: ${best.title} (${best.subject}), ${best.percent}%` });
  return (
    <section className="pd-section" aria-labelledby="pd-improve">
      <h2 id="pd-improve">{copy.improvementsTitle}</h2>
      {items.length ? (
        <ul className="pd-improve">
          {items.map((item) => (
            <li key={item.text}>
              <span className="pd-improve-mark" aria-hidden="true">
                {item.mark}
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="pd-empty">{copy.noImprovements}</p>
      )}
    </section>
  );
}

/** Marks over time (all subjects, or one) and attendance week by week. */
function Charts({ records, today }: { records: StudentRecords; today: string }) {
  const subjects = records.student.subjects;
  // One subject at a time reads as a clear line; mixing subjects zig-zags between them.
  const [subject, setSubject] = useState<string | null>(subjects.length > 1 ? subjects[0]! : null);
  const points = testTimeline(records, today).filter((p) => !subject || p.subject === subject);
  const name = records.student.name.split(" ")[0];
  return (
    <section className="pd-section" aria-labelledby="pd-charts">
      <h2 id="pd-charts">{copy.chartsTitle}</h2>
      <div className="pd-card pd-chart-card">
        <div className="pd-chart-head">
          <h3>{copy.marksChart}</h3>
          {subjects.length > 1 && (
            <div className="pd-picker pd-picker-sm" role="group" aria-label="Subject">
              {[...subjects, null].map((s) => (
                <button
                  key={s ?? "all"}
                  type="button"
                  aria-pressed={subject === s}
                  onClick={() => setSubject(s)}
                >
                  {s ?? copy.allSubjects}
                </button>
              ))}
            </div>
          )}
        </div>
        <MarksChart
          points={points}
          label={`${name}'s test marks over time${subject ? ` in ${subject}` : ""}, as a percentage`}
        />
      </div>
      <div className="pd-card pd-chart-card">
        <div className="pd-chart-head">
          <h3>{copy.attendanceChart}</h3>
        </div>
        <AttendanceChart
          weeks={weeklyAttendance(records, today)}
          label={`${name}'s attendance in each of the last 8 weeks`}
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "watch" | undefined;
}) {
  return (
    <div className={`pd-stat${tone ? ` pd-stat-${tone}` : ""}`}>
      <span className="pd-stat-label">{label}</span>
      <strong className="pd-stat-value">{value}</strong>
      <span className="pd-stat-hint">{hint}</span>
    </div>
  );
}

function SubjectRow({ s, focus }: { s: SubjectSummary; focus: boolean }) {
  return (
    <li className={`pd-subject${focus ? " is-focus" : ""}`}>
      <div className="pd-subject-head">
        <strong>{s.subject}</strong>
        <TrendPill trend={s.trend} delta={s.delta} />
      </div>
      <div className="pd-subject-body">
        <span className="pd-subject-avg">{s.average == null ? "–" : `${s.average}%`}</span>
        <Sparkline
          values={s.history}
          label={`${s.subject} test marks over time: ${s.history.join("%, ")}%`}
        />
      </div>
      {s.latest && (
        <small className="pd-muted">
          Latest: {s.latest.title},{" "}
          {s.latest.percent == null ? copy.absent.toLowerCase() : `${s.latest.percent}%`}
          {s.attendance.held > 0 && ` · ${s.attendance.attended}/${s.attendance.held} classes`}
        </small>
      )}
    </li>
  );
}

function TrendPill({ trend, delta }: { trend: Trend; delta: number | null }) {
  const arrow = trend === "up" ? "↑ " : trend === "down" ? "↓ " : "";
  const points = delta != null && trend !== "steady" ? ` ${Math.abs(delta)}` : "";
  return (
    <span className={`pd-pill pd-pill-${trend}`}>
      {arrow}
      {DASHBOARD_CONFIG.trendLabels[trend]}
      {points && <span className="pd-sr">,{points} points</span>}
    </span>
  );
}

/** A small line of the child's test percentages, oldest to newest, always drawn on a 0-100 scale. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <span className="pd-spark" />;
  const w = 120;
  const h = 36;
  const pts = values.map(
    (v, i) => [(i / (values.length - 1)) * (w - 6) + 3, h - 3 - (v / 100) * (h - 6)] as const,
  );
  const last = pts.at(-1)!;
  return (
    <svg className="pd-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} className="pd-spark-mid" />
      <polyline points={pts.map((p) => p.join(",")).join(" ")} className="pd-spark-line" />
      <circle cx={last[0]} cy={last[1]} r="3.5" className="pd-spark-dot" />
    </svg>
  );
}

const statusLabel = {
  present: "Present",
  late: "Late",
  absent: "Missed",
  cancelled: "Cancelled by Stoodant",
} as const;

function ClassStrip({ records, from, to }: { records: StudentRecords; from: string; to: string }) {
  const items = records.attendance
    .filter((r) => r.date >= from && r.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) return <p className="pd-empty">No classes in this period.</p>;
  return (
    <>
      <ul className="pd-classes">
        {items.map((r) => (
          <li
            key={`${r.date}-${r.subject}`}
            className={`pd-dot pd-dot-${r.status}`}
            title={`${formatDay(r.date)} · ${r.subject}: ${statusLabel[r.status]}`}
          >
            <span className="pd-sr">
              {formatDay(r.date)}, {r.subject}: {statusLabel[r.status]}
            </span>
          </li>
        ))}
      </ul>
      <p className="pd-legend" aria-hidden="true">
        <span className="pd-dot pd-dot-present" /> Present <span className="pd-dot pd-dot-absent" />{" "}
        Missed <span className="pd-dot pd-dot-cancelled" /> Cancelled by us
      </p>
    </>
  );
}

/** Renders WhatsApp's *bold* so the preview looks like the message the parent receives. */
function WhatsAppText({ text }: { text: string }) {
  return (
    <p className="pd-chat-bubble">
      {text.split("\n").map((line, i) => (
        <span key={i} className="pd-chat-line">
          {line
            .split(/(\*[^*]+\*)/)
            .map((part, j) =>
              part.startsWith("*") && part.endsWith("*") ? (
                <strong key={j}>{part.slice(1, -1)}</strong>
              ) : (
                part
              ),
            )}
        </span>
      ))}
    </p>
  );
}

function attendanceTone(p: number | null) {
  if (p == null) return undefined;
  return p >= attendanceGood ? "good" : p < attendanceWatch ? "watch" : undefined;
}

function attendanceHint(o: Overview) {
  return o.attendance.held
    ? `${o.attendance.attended} of ${o.attendance.held} classes`
    : "No classes";
}

/** One calm sentence a parent can read in two seconds. */
function summarySentence(name: string, o: Overview) {
  const first = name.split(" ")[0];
  const parts: string[] = [];
  if (o.attendance.held)
    parts.push(`${first} attended ${o.attendance.attended} of ${o.attendance.held} classes`);
  const up = o.subjects.filter((s) => s.trend === "up").map((s) => s.subject);
  if (up.length) parts.push(`${up.join(" and ")} ${up.length > 1 ? "are" : "is"} improving`);
  if (o.focus) parts.push(`${o.focus.subject} is the next focus, and the teacher is on it`);
  return parts.length
    ? `${parts.join(". ")}.`
    : "Progress will show here after the first few classes.";
}
