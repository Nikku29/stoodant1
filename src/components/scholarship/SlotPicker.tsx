import { useEffect, useState } from "react";
import { SCHOLARSHIP_EXAM as X, slotDay, slotHours, slotLabel, slotStart } from "@/lib/scholarship";
import { SLOT_ENDPOINT, post, type Registered } from "@/lib/scholarship";

const display = "font-[family-name:var(--font-display)]";
type Slot = { id: string; full: boolean; open: boolean };
const MIN = 60_000;

/**
 * After the fee is confirmed: the family picks the exam hour, and on the day the Join button appears here
 * (from 10 minutes before the hour until the paper's last possible minute).
 */
export function SlotPicker({ done, update }: { done: Registered; update: (next: Registered) => void }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 20_000); return () => clearInterval(t); }, []);

  // The server adds the exam password to this list only from 10 minutes before the booked hour.
  const [askedAt, setAskedAt] = useState(0);
  const current0 = done.slotId ?? null;
  const joinFrom = current0 ? slotStart(current0) - X.earlyMinutes * MIN : 0;
  useEffect(() => {
    // Ask again when the Join time comes, so the password appears without a reload.
    if (!current0 || password || now < joinFrom || askedAt >= joinFrom) return;
    setAskedAt(now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);
  useEffect(() => {
    void post(SLOT_ENDPOINT, JSON.stringify({ regNo: done.regNo, token: done.payment.token })).then((answer) => {
      if (answer?.status !== 200) return;
      setSlots(answer.data["slots"] as Slot[]);
      if (typeof answer.data["password"] === "string") setPassword(answer.data["password"]);
      const current = (answer.data["slotId"] as string | null) ?? null;
      if (current !== (done.slotId ?? null)) update({ ...done, slotId: current });
    });
    // Once per registration shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done.regNo, askedAt]);

  const book = async (id: string) => {
    setBusy(id);
    setError("");
    const answer = await post(SLOT_ENDPOINT, JSON.stringify({ regNo: done.regNo, token: done.payment.token, slotId: id }));
    setBusy("");
    if (answer?.status === 200) {
      setSlots(answer.data["slots"] as Slot[]);
      setEditing(false);
      return update({ ...done, slotId: id });
    }
    const code = answer?.data["error"];
    setError(code === "full" ? X.slots.errors.full : code === "closed" ? X.slots.errors.closed : X.slots.errors.network);
  };

  const current = done.slotId ?? null;
  if (current && !editing) {
    const start = slotStart(current);
    const canChange = now < start - X.bookingClosesMinutes * MIN;
    const joinOpen = now >= start - X.earlyMinutes * MIN && now <= start + (X.minutes + X.lateJoinMinutes) * MIN;
    const over = now > start + (X.minutes + X.lateJoinMinutes) * MIN;
    return (
      <div className="mt-5 rounded-2xl bg-white p-5 text-[#0a1026]">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-neutral-500">{X.slots.yours}</p>
        <p className={`${display} mt-1 text-2xl font-extrabold`}>{slotLabel(current)}</p>
        {joinOpen ? (
          <>
            <p className="mt-3 leading-7">{X.join.open}</p>
            {password && (
              <div className="mt-3 rounded-xl bg-neutral-100 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-neutral-500">{X.join.password}</p>
                <p className={`${display} select-all text-2xl font-extrabold tracking-widest`}>{password}</p>
                <p className="text-sm text-neutral-600">{X.join.passwordNote.replace("{date}", new Date(Date.UTC(+password.slice(4), +password.slice(2, 4) - 1, +password.slice(0, 2))).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }))}</p>
              </div>
            )}
            <a href={`/exam?roll=${encodeURIComponent(done.rollNo ?? "")}`} className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-[#fbb308] px-5 text-lg font-extrabold">{X.join.button}</a>
          </>
        ) : over ? (
          <p className="mt-3 leading-7 text-neutral-700">{X.join.missed}</p>
        ) : (
          <p className="mt-3 leading-7 text-neutral-700">{X.join.opensAt.replace("{time}", slotHours(current).split(" to ")[0]!).replace("{date}", slotDay(current))}</p>
        )}
        {canChange && <button type="button" onClick={() => setEditing(true)} className="mt-3 text-sm font-bold underline">{X.slots.change}</button>}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl bg-white p-5 text-[#0a1026]">
      <h3 className={`${display} text-xl font-bold`}>{X.slots.heading}</h3>
      <p className="mt-1 text-sm leading-6 text-neutral-600">{X.slots.lead}</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {!slots && <p className="mt-3 text-sm text-neutral-500">…</p>}
      {slots && X.dates.map((date) => (
        <div key={date} className="mt-4">
          <p className="text-sm font-bold">{slotDay(`${date}T09`)}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slots.filter((s) => s.id.startsWith(date)).map((s) => {
              const off = s.full || !s.open;
              return (
                <button key={s.id} type="button" disabled={off || Boolean(busy)} onClick={() => void book(s.id)}
                  aria-pressed={s.id === current}
                  className="min-h-12 rounded-xl border border-neutral-300 px-2 text-sm font-semibold aria-pressed:border-[#0a1026] aria-pressed:bg-[#0a1026] aria-pressed:text-white disabled:bg-neutral-100 disabled:text-neutral-400">
                  {busy === s.id ? X.slots.saving : slotHours(s.id)}
                  {off && <span className="block text-xs font-normal">{s.full ? X.slots.full : X.slots.closed}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {current && <button type="button" onClick={() => setEditing(false)} className="mt-4 text-sm font-bold underline">{slotLabel(current)}</button>}
    </div>
  );
}
