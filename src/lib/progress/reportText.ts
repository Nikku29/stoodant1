import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import {
  formatDay,
  formatMonth,
  monthOf,
  overview,
  weekOf,
  type Overview,
  type StudentRecords,
  type SubjectSummary,
} from "./insights";

// The WhatsApp reports, built from the same numbers the dashboard shows. WhatsApp formatting:
// *bold*. Kept well under WhatsApp's 1,024-character limit for a template message body.
const DASHBOARD_URL = "stoodant.com/parent";
const { attendanceWatch } = DASHBOARD_CONFIG.insights;

const firstName = (name: string) => name.split(" ")[0];
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function trendLine(s: SubjectSummary) {
  if (s.trend === "up") return `${s.subject} is improving (${signed(s.delta as number)} points)`;
  if (s.trend === "down")
    return `${s.subject} needs a little focus (down ${Math.abs(s.delta as number)} points)`;
  if (s.trend === "steady") return `${s.subject} is steady`;
  return null;
}

function attendanceLine(o: Overview) {
  const a = o.attendance;
  if (!a.held) return "No classes this time.";
  return `${a.attended} of ${a.held} classes (${a.percent}%)`;
}

function noteLines(o: Overview) {
  return o.notes.slice(0, 2).map((n) => `${n.subject}: ${n.lines.join(". ")}.`);
}

/** Sent every Sunday evening. `date` is any day in the week being reported. */
export function weeklyReport(records: StudentRecords, date: string) {
  const period = weekOf(date);
  const o = overview(records, period);
  const child = firstName(records.student.name);
  const lines = [
    `Hi ${records.student.parentName}, here is ${child}'s week at Stoodant (${formatDay(period.from)} to ${formatDay(period.to)}).`,
    "",
    `*Attendance:* ${attendanceLine(o)}`,
  ];
  if (o.tests.length) {
    lines.push("*Tests this week:*");
    for (const t of o.tests.slice(0, 3)) {
      lines.push(
        t.score == null
          ? `• ${t.subject}, ${t.title}: missed`
          : `• ${t.subject}, ${t.title}: ${t.score}/${t.max} (${t.percent}%)`,
      );
    }
  }
  const moving = o.subjects.filter((s) => s.trend === "up" || s.trend === "down").map(trendLine);
  if (moving.length) lines.push(`*How it's going:* ${moving.join(". ")}.`);
  const notes = noteLines(o);
  if (notes.length) lines.push("*Teacher's note:*", ...notes);
  lines.push("", `See the full picture: ${DASHBOARD_URL}`, "Any questions? Just reply here.");
  return lines.join("\n");
}

/** Sent on the 1st of each month. `date` is any day in the month being reported. */
export function monthlyReport(records: StudentRecords, date: string) {
  const period = monthOf(date);
  const o = overview(records, period);
  const child = firstName(records.student.name);
  const lines = [
    `Hi ${records.student.parentName}, here is ${child}'s ${formatMonth(period.from)} report from Stoodant.`,
    "",
    `*Attendance:* ${attendanceLine(o)}`,
  ];
  if (o.attendance.percent != null && o.attendance.percent < attendanceWatch) {
    lines.push(
      `A few classes were missed this month. If timings are hard, reply and we'll help find a better slot.`,
    );
  }
  if (o.average != null) {
    const change =
      o.delta == null
        ? ""
        : o.delta >= 0
          ? `, ${signed(o.delta)} points on recent tests`
          : `, down ${-o.delta} points on recent tests`;
    lines.push(`*Average marks:* ${o.average}%${change}`);
  }
  lines.push("*Subjects:*");
  for (const s of o.subjects) {
    const avg = s.average == null ? "no test this month" : `${s.average}%`;
    lines.push(`• ${s.subject}: ${avg}, ${DASHBOARD_CONFIG.trendLabels[s.trend].toLowerCase()}`);
  }
  if (o.strongest) lines.push(`*Doing well in:* ${o.strongest.subject}`);
  if (o.focus)
    lines.push(`*Next focus:* ${o.focus.subject}. The teacher will give extra practice here.`);
  const notes = noteLines(o);
  if (notes.length) lines.push("*Teacher's note:*", ...notes);
  lines.push("", `See the full picture: ${DASHBOARD_URL}`, "Any questions? Just reply here.");
  return lines.join("\n");
}
