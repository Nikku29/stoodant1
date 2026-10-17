// The Stoodant ant: one <symbol> defined once (<AntSprite />) and reused with <use>.
// Line art, 2px round strokes in currentColor; only the eyes and antenna tips are amber.
// Poses are driven by custom properties that inherit into the <use> instance (see ANT_CSS in brandCss.ts).
import { BRAND_COLORS } from "./logoMarkup";

export const ANT_SYMBOL_ID = "stoodant-ant";
export type AntPose = "walk" | "wave" | "celebrate" | "static";

const { amber, white, pupilOnDark } = BRAND_COLORS;

/** Render once per page (it draws nothing). */
export function AntSprite() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <symbol id={ANT_SYMBOL_ID} viewBox="0 0 64 48">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <g className="ant-legs-a">
            <path className="ant-wave-leg" d="M40 30l5 4 2 7" />
            <path d="M35 31l-1 5-3 5" />
            <path d="M31 30l-5 4-3 7" />
          </g>
          <g className="ant-legs-b">
            <path d="M39 31l3 5 1 5" />
            <path d="M34 31l1 5 3 5" />
            <path d="M30 31l-3 5-1 5" />
          </g>
          <g className="ant-body">
            <ellipse cx="15" cy="24" rx="10" ry="8" />
            <circle cx="27" cy="27" r="3" />
            <ellipse cx="36" cy="27" rx="5.5" ry="4.5" />
            <circle cx="50" cy="19" r="9.5" />
            <path d="M46 10l-4-7M53 10l3-7" />
            <path d="M47.5 19h2" />
            <circle cx="42" cy="3" r="1.8" fill={amber} stroke="none" />
            <circle cx="56" cy="3" r="1.8" fill={amber} stroke="none" />
            <g stroke="none">
              <circle cx="45" cy="19" r="3.6" fill={amber} />
              <circle cx="53" cy="19" r="3.6" fill={amber} />
              <circle cx="46" cy="18.5" r="1.6" fill={pupilOnDark} />
              <circle cx="54" cy="18.5" r="1.6" fill={pupilOnDark} />
              <circle cx="46.6" cy="17.8" r=".55" fill={white} />
              <circle cx="54.6" cy="17.8" r=".55" fill={white} />
            </g>
          </g>
        </g>
      </symbol>
    </svg>
  );
}

/** Use inside an <svg> (scenes) at a given position; the 64x48 box sits with its feet at y = 41. */
export function AntUse({ pose = "static", className = "", x = 0, y = 0, width = 64 }: { pose?: AntPose; className?: string; x?: number; y?: number; width?: number }) {
  return <use href={`#${ANT_SYMBOL_ID}`} x={x} y={y} width={width} height={(width * 48) / 64} className={`ant ant-${pose} ${className}`.trim()} />;
}

/** A standalone ant (inline). Decorative by default. */
export function Ant({ pose = "static", className = "", label }: { pose?: AntPose; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={`ant ant-${pose} ${className}`.trim()} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <use href={`#${ANT_SYMBOL_ID}`} width="64" height="48" />
    </svg>
  );
}
