// The one source of the Stoodant logo, traced from brand-assets/stoodant-logo-original.jpeg.
// Logo.tsx (navbar, menu, footer, form success, splash) and the dev-only favicon/OG script all
// render from buildLogo(). Imports carry explicit .ts extensions so plain Node can run it too.
import { SITE_CONFIG } from "../config/siteConfig.ts";

export type LogoVariant = "full" | "wordmark" | "mark";
export type LogoTone = "light" | "dark";

/** Sampled from the original file; mirrored as CSS variables and Tailwind tokens in styles.css. */
export const BRAND_COLORS = {
  ink: "#0A1026",
  amber: "#FBB308",
  white: "#FFFFFF",
  pupilOnDark: "#0A0A0A",
} as const;

export const LOGO_LABEL = "Stoodant, your class, your pace, your tutor";

const VIEWBOX: Record<LogoVariant, string> = {
  wordmark: "0 0 1110 190",
  full: "0 0 1110 262",
  mark: "234 43 298 145",
};

// Letter strokes are 29 units wide with round caps and joins, as in the original.
const STROKED: Record<string, string> = {
  s: "M97 58.5H42.5A28 28 0 0 0 42.5 114.5H69A28 28 0 0 1 69 170.5H14.5",
  t1: "M134.5 59.5H213.5M174.5 59.5V171.5",
  a: "M736 172L793 62L851 172M752 141H835",
  n: "M888 172.5V60.5L972.5 172.5V60.5",
  t2: "M1013.5 60.5H1094.5M1053.5 60.5V172.5",
};
const D_PATH = "M555 44H596A71.5 71.5 0 0 1 596 187H555Q544 187 544 176V55Q544 44 555 44ZM572 73H597A42 42 0 0 1 597 157H572Z";
const EYES = [306.5, 460];
const EYE_CY = 115.5;
// Tagline phrases sit side by side across the wordmark width (x, width), one <text> each so they can fade in turn.
const PHRASE_BOXES = [[3, 354], [390, 322], [748, 359]] as const;

export function logoViewBox(variant: LogoVariant) {
  return VIEWBOX[variant];
}

/** Inner SVG markup. Every part has a unique id (prefixed per instance) and a class for animation. */
export function buildLogo(variant: LogoVariant, tone: LogoTone, prefix = "lg"): string {
  const ink = tone === "dark" ? BRAND_COLORS.white : BRAND_COLORS.ink;
  const pupil = tone === "dark" ? BRAND_COLORS.pupilOnDark : BRAND_COLORS.ink;
  const { amber, white } = BRAND_COLORS;
  const id = (part: string) => `id="${prefix}-${part}"`;
  const letter = (key: string, i: number, body: string) => `<path ${id(`letter-${key}`)} class="lg-letter" style="--i:${i}" ${body}/>`;
  const stroked = (key: string, i: number) =>
    letter(key, i, `d="${STROKED[key]}" fill="none" stroke="${ink}" stroke-width="29" stroke-linecap="round" stroke-linejoin="round"`);

  // Each O is a group: the amber eye (blinks), pupil + glint (look around), and the ring on top.
  const bridge = `<rect ${id("bridge")} class="lg-bridge" x="372" y="101.5" width="22" height="10" fill="${ink}"/>`;
  const eyes =
    bridge +
    EYES.map((cx, n) => {
      const side = n ? "r" : "l";
      return (
        `<g ${id(`letter-o${n + 1}`)} class="lg-letter" style="--i:${n + 2}">` +
        `<g ${id(`eyeball-${side}`)} class="lg-eyeball"><circle ${id(`eye-${side}`)} class="lg-eye" cx="${cx}" cy="${EYE_CY}" r="43" fill="${amber}"/>` +
        `<g ${id(`look-${side}`)} class="lg-look"><circle ${id(`pupil-${side}`)} cx="${cx + 8.5}" cy="106" r="17" fill="${pupil}"/>` +
        `<circle ${id(`glint-${side}`)} cx="${cx + 15.5}" cy="99" r="5.5" fill="${white}"/></g></g>` +
        `<circle ${id(`ring-o${n + 1}`)} cx="${cx}" cy="${EYE_CY}" r="56" fill="none" stroke="${ink}" stroke-width="29"/></g>`
      );
    }).join("");

  if (variant === "mark") return eyes;

  const letters =
    stroked("s", 0) +
    stroked("t1", 1) +
    eyes +
    letter("d", 4, `d="${D_PATH}" fill="${ink}" fill-rule="evenodd"`) +
    stroked("a", 5) +
    stroked("n", 6) +
    stroked("t2", 7);
  const accents =
    `<g ${id("sparks")} fill="none" stroke="${amber}" stroke-width="7" stroke-linecap="round">` +
    `<path ${id("spark-1")} class="lg-spark" d="M280 6.5L285 34"/><path ${id("spark-2")} class="lg-spark" style="--i:1" d="M254 21L270 33"/></g>` +
    `<path ${id("stripe-s")} class="lg-stripe" d="M44.5 82H83.5M44 92H72" stroke="${amber}" stroke-width="4.5" stroke-linecap="round"/>` +
    `<path ${id("triangle-a")} class="lg-triangle" d="M793.5 102.5L805 123.5H782Z" fill="${amber}" stroke="${amber}" stroke-width="2" stroke-linejoin="round"/>`;

  if (variant === "wordmark") return letters + accents;

  const phrases = SITE_CONFIG.brand.tagline.toUpperCase().split(/(?<=\.)\s+/);
  const tagline =
    `<g ${id("tagline")} class="lg-tagline" fill="${ink}" font-family="Inter,system-ui,sans-serif" font-size="38">` +
    phrases
      .map((p, i) => {
        const [x, w] = PHRASE_BOXES[i] ?? PHRASE_BOXES[0];
        return `<text ${id(`tagline-${i + 1}`)} class="lg-phrase" style="--i:${i}" x="${x}" y="250" textLength="${w}" lengthAdjust="spacing">${p}</text>`;
      })
      .join("") +
    `</g>`;
  return letters + accents + tagline;
}

/** A standalone SVG document (favicon and the raster script). */
export function logoSvgDocument(variant: LogoVariant, tone: LogoTone, prefix = "lg", attrs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[variant]}" role="img" aria-label="${LOGO_LABEL}"${attrs ? ` ${attrs}` : ""}>${buildLogo(variant, tone, prefix)}</svg>`;
}
