import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { formatDay, type TestPoint, type WeekAttendance } from "@/lib/progress/insights";

// Two small charts for the parent's page, drawn as plain SVG so no chart library loads.
// One series each, in the brand ink, so colour never has to carry meaning. Hover, tap or the arrow keys
// show the exact value; a hidden table gives screen readers the same numbers.

const H = 220;
const PAD = { top: 18, right: 44, bottom: 30, left: 40 };
const y = (percent: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - percent / 100);
const plotH = H - PAD.top - PAD.bottom;
const GRID = [0, 50, 100];

/**
 * The chart is drawn at its real width, so text stays readable on a phone instead of shrinking with a
 * scaled-down picture. 360 until the first measurement.
 */
function useWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    if (!el) return;
    const measure = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

/** Which point or bar is under the pointer, from its x position across the chart. */
function usePick(count: number, W: number) {
  const plotW = W - PAD.left - PAD.right;
  const ref = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !count) return;
    const x = ((e.clientX - box.left) / box.width) * W - PAD.left;
    const i = count === 1 ? 0 : Math.round((x / plotW) * (count - 1));
    setActive(Math.max(0, Math.min(count - 1, i)));
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowLeft" ? -1 : 1;
    setActive((a) => Math.max(0, Math.min(count - 1, (a ?? count - 1) + (a == null ? 0 : step))));
  };
  return {
    active,
    svg: {
      ref,
      tabIndex: 0,
      onPointerMove,
      onPointerDown: onPointerMove,
      onPointerLeave: () => setActive(null),
      onBlur: () => setActive(null),
      onKeyDown,
    },
  };
}

function Grid({ W }: { W: number }) {
  return (
    <g aria-hidden="true">
      {GRID.map((g) => (
        <g key={g}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} className="pd-chart-grid" />
          <text x={PAD.left - 8} y={y(g) + 4} className="pd-chart-tick" textAnchor="end">
            {g}%
          </text>
        </g>
      ))}
    </g>
  );
}

function Tip({
  x,
  top,
  W,
  children,
}: {
  x: number;
  top: number;
  W: number;
  children: React.ReactNode;
}) {
  // Kept inside the chart: the box flips to the left of the point on the right-hand side.
  const left = (x / W) * 100;
  return (
    <div
      className={`pd-chart-tip${left > 60 ? " is-left" : ""}`}
      style={{ left: `${left}%`, top: `${(top / H) * 100}%` }}
      role="status"
    >
      {children}
    </div>
  );
}

/** Each marked test as a percentage, oldest to newest. */
export function MarksChart({ points, label }: { points: TestPoint[]; label: string }) {
  const [box, W] = useWidth();
  const plotW = W - PAD.left - PAD.right;
  const { active, svg } = usePick(points.length, W);
  if (points.length < 2)
    return <p className="pd-empty">The chart appears after the first two tests.</p>;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * plotW;
  const line = points.map((p, i) => `${x(i)},${y(p.percent)}`).join(" ");
  const last = points.length - 1;
  const shown = active ?? null;
  // Date labels about every 80px, always including the first and last test.
  const step = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 80))));
  return (
    <figure className="pd-chart">
      <div className="pd-chart-box" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} {...svg}>
          <Grid W={W} />
          <polyline points={line} className="pd-chart-line" />
          {shown != null && (
            <line
              x1={x(shown)}
              x2={x(shown)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              className="pd-chart-cross"
            />
          )}
          {points.map((p, i) => (
            <circle
              key={`${p.date}-${p.title}`}
              cx={x(i)}
              cy={y(p.percent)}
              r={i === shown ? 6 : 4}
              className={i === last ? "pd-chart-dot is-last" : "pd-chart-dot"}
            />
          ))}
          <text x={x(last) + 10} y={y(points[last]!.percent) + 4} className="pd-chart-label">
            {points[last]!.percent}%
          </text>
          {points.map((p, i) =>
            i % step === 0 || i === last ? (
              <text
                key={`d-${p.date}-${p.title}`}
                x={x(i)}
                y={H - 8}
                className="pd-chart-tick"
                textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
              >
                {formatDay(p.date)}
              </text>
            ) : null,
          )}
        </svg>
        {shown != null && (
          <Tip x={x(shown)} top={y(points[shown]!.percent)} W={W}>
            <strong>{points[shown]!.percent}%</strong> {points[shown]!.title}
            <small>
              {points[shown]!.subject} · {formatDay(points[shown]!.date)}
            </small>
          </Tip>
        )}
      </div>
      <table className="pd-sr">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Test</th>
            <th>Marks</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={`t-${p.date}-${p.title}`}>
              <td>{formatDay(p.date)}</td>
              <td>
                {p.title}, {p.subject}
              </td>
              <td>{p.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Share of classes attended in each week, oldest to newest. Weeks with no classes stay empty. */
export function AttendanceChart({ weeks, label }: { weeks: WeekAttendance[]; label: string }) {
  const [box, W] = useWidth();
  const plotW = W - PAD.left - PAD.right;
  const { active, svg } = usePick(weeks.length, W);
  // On a narrow screen every other week is labelled, ending with this week.
  const labelEvery = plotW / weeks.length < 52 ? 2 : 1;
  if (!weeks.some((w) => w.held))
    return <p className="pd-empty">The chart appears after the first week of classes.</p>;
  const slot = plotW / weeks.length;
  const barW = Math.min(36, slot - 8);
  const cx = (i: number) => PAD.left + slot * i + slot / 2;
  const last = weeks.length - 1;
  return (
    <figure className="pd-chart">
      <div className="pd-chart-box" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} {...svg}>
          <Grid W={W} />
          {weeks.map((w, i) => {
            const top = w.percent == null ? y(0) : y(w.percent);
            const h = Math.max(0, y(0) - top);
            return (
              <g key={w.from}>
                {w.percent == null ? (
                  <rect
                    x={cx(i) - barW / 2}
                    y={y(0) - 2}
                    width={barW}
                    height={2}
                    className="pd-chart-none"
                  />
                ) : (
                  <path
                    d={roundedTop(cx(i) - barW / 2, top, barW, h, Math.min(4, h))}
                    className={`pd-chart-bar${i === active ? " is-on" : ""}`}
                  />
                )}
                {(last - i) % labelEvery === 0 && (
                  <text x={cx(i)} y={H - 8} className="pd-chart-tick" textAnchor="middle">
                    {formatDay(w.from)}
                  </text>
                )}
              </g>
            );
          })}
          {weeks[last]!.percent != null && (
            <text
              x={cx(last)}
              y={y(weeks[last]!.percent!) - 8}
              className="pd-chart-label"
              textAnchor="middle"
            >
              {weeks[last]!.percent}%
            </text>
          )}
        </svg>
        {active != null && (
          <Tip x={cx(active)} top={y(weeks[active]!.percent ?? 0)} W={W}>
            <strong>{weeks[active]!.percent == null ? "–" : `${weeks[active]!.percent}%`}</strong>{" "}
            {weeks[active]!.held
              ? `${weeks[active]!.attended} of ${weeks[active]!.held} classes`
              : "No classes"}
            <small>Week of {formatDay(weeks[active]!.from)}</small>
          </Tip>
        )}
      </div>
      <table className="pd-sr">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Week of</th>
            <th>Classes attended</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={`t-${w.from}`}>
              <td>{formatDay(w.from)}</td>
              <td>{w.held ? `${w.attended} of ${w.held} (${w.percent}%)` : "No classes"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** A bar with rounded top corners, square on the baseline. */
function roundedTop(x: number, top: number, w: number, h: number, r: number) {
  const b = top + h;
  return `M${x},${b}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${b}Z`;
}
