import type { LiveClass } from "@/lib/firebase/classes";
import type { ClassStore } from "./LiveClasses";

const HOUR = 3_600_000;

/** Two sample classes around now: one about to start, one next week. For previews and practice mode. */
export function sampleClasses(now = Date.now()): LiveClass[] {
  const base = {
    batchId: "sample",
    batchName: "Class 7 Maths",
    subject: "Maths",
    teacherName: "Priya Ma'am",
    joinUrl: "https://zoom.us/j/0000000000",
    durationMinutes: 60,
    status: "scheduled" as const,
    seriesId: "sample-series",
  };
  const soon = Math.ceil((now + 5 * 60_000) / 300_000) * 300_000;
  return [
    { ...base, id: "sample-1", topic: "Chapter 5: Fractions", startAt: soon, endAt: soon + HOUR },
    { ...base, id: "sample-2", topic: "Chapter 6: Decimals", startAt: soon + 7 * 24 * HOUR, endAt: soon + 7 * 24 * HOUR + HOUR },
  ];
}

/** Practice mode: every button works on this list in memory, so the teacher sees the result. Nothing is saved or sent. */
export function practiceClassStore(): ClassStore {
  let list = sampleClasses();
  let n = 0;
  return {
    list: async () => [...list].sort((a, b) => a.startAt - b.startAt),
    lastLink: async () => list[0]?.joinUrl ?? "",
    schedule: async (input) => {
      const seriesId = input.starts.length > 1 ? `practice-${++n}` : null;
      for (const iso of input.starts) {
        const startAt = Date.parse(iso);
        list.push({
          ...list[0]!,
          id: `practice-${++n}`,
          topic: input.topic,
          joinUrl: input.joinUrl,
          durationMinutes: input.durationMinutes,
          startAt,
          endAt: startAt + input.durationMinutes * 60_000,
          status: "scheduled",
          seriesId,
        });
      }
      return { saved: true, changed: input.starts.length };
    },
    change: async (input) => {
      const c = list.find((x) => x.id === input.classId);
      if (!c) return { saved: true, changed: 0 };
      const hit = (x: (typeof list)[number]) =>
        x.id === c.id || ("following" in input && input.following && c.seriesId && x.seriesId === c.seriesId && x.startAt >= c.startAt);
      if (input.action === "cancel") list = list.filter((x) => !hit(x));
      else if (input.action === "move") {
        const startAt = Date.parse(input.startAt);
        const mins = input.durationMinutes ?? c.durationMinutes;
        Object.assign(c, { startAt, endAt: startAt + mins * 60_000, durationMinutes: mins });
      } else
        for (const x of list.filter(hit))
          Object.assign(x, { joinUrl: input.joinUrl ?? x.joinUrl, topic: input.topic ?? x.topic });
      return { saved: true };
    },
  };
}
