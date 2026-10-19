// The one source of the Stoodant logo, traced from the official brand-assets/stoodant-logo-official.jpeg
// (coordinates are that image's pixels, so the viewBoxes start where the artwork does).
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
  wordmark: "132 248 1346 222",
  full: "132 248 1346 286",
  mark: "436 307 360 168",
};

// Letter strokes are 36 units wide with round caps and joins, as in the official artwork.
const STROKE = 36;
const STROKED: Record<string, string> = {
  s: "M274 328H186A26 26 0 0 0 186 380H249.5A31.5 31.5 0 0 1 249.5 443H158",
  t1: "M315 330H441M370.5 330V440",
  // A and N are one zigzag: the A has no crossbar (the amber triangle sits inside) and runs straight into the N.
  an: "M970 444L1045 331L1135 444L1179 331L1310 444",
  t2: "M1269 330H1452M1379.5 330V440",
};
const D_PATH = "M813 312H888A73 73 0 0 1 888 458H813Q801 458 801 446V324Q801 312 813 312ZM840 345H882A40 40 0 0 1 882 425H840Z";
const EYES = [523.5, 708];
const EYE_CY = 391;
/** Pupil offset from the eye centre, shared with Logo.tsx so the pointer-follow starts from rest. */
export const PUPIL_OFFSET = { x: 19.5, y: -16 };
// Tagline phrases sit side by side across the wordmark width (x, width), one <text> each so they can fade in turn.
const PHRASE_BOXES = [[289, 321], [645, 294], [974, 335]] as const;

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
    letter(key, i, `d="${STROKED[key]}" fill="none" stroke="${ink}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"`);

  // Each O is a group: the amber eye (blinks), pupil + glint (look around), and the ring on top.
  const bridge = `<rect ${id("bridge")} class="lg-bridge" x="598" y="353" width="36" height="10" fill="${ink}"/>`;
  const eyes =
    bridge +
    EYES.map((cx, n) => {
      const side = n ? "r" : "l";
      return (
        `<g ${id(`letter-o${n + 1}`)} class="lg-letter" style="--i:${n + 2}">` +
        `<g ${id(`eyeball-${side}`)} class="lg-eyeball"><circle ${id(`eye-${side}`)} class="lg-eye" cx="${cx}" cy="${EYE_CY}" r="50" fill="${amber}"/>` +
        `<g ${id(`look-${side}`)} class="lg-look"><circle ${id(`pupil-${side}`)} cx="${cx + PUPIL_OFFSET.x}" cy="${EYE_CY + PUPIL_OFFSET.y}" r="26" fill="${pupil}"/>` +
        `<circle ${id(`glint-${side}`)} cx="${cx + 31}" cy="${EYE_CY - 31}" r="9.5" fill="${white}"/></g></g>` +
        `<circle ${id(`ring-o${n + 1}`)} cx="${cx}" cy="${EYE_CY}" r="64" fill="none" stroke="${ink}" stroke-width="31"/></g>`
      );
    }).join("");

  if (variant === "mark") return eyes;

  const letters =
    stroked("s", 0) +
    stroked("t1", 1) +
    eyes +
    letter("d", 4, `d="${D_PATH}" fill="${ink}" fill-rule="evenodd"`) +
    stroked("an", 5) +
    stroked("t2", 6);
  // The N's amber edge sits under the ink (drawn first), offset up and right along its diagonal, like the artwork's bevel.
  const edge = `<path ${id("edge-n")} class="lg-stripe" d="M1209 328L1324 427" stroke="${amber}" stroke-width="22" stroke-linecap="round"/>`;
  const accents =
    `<g ${id("sparks")} fill="none" stroke="${amber}" stroke-width="12" stroke-linecap="round">` +
    `<path ${id("spark-1")} class="lg-spark" d="M506 260L514 290"/><path ${id("spark-2")} class="lg-spark" style="--i:1" d="M467 283L488 298"/></g>` +
    `<path ${id("stripe-s")} class="lg-stripe" d="M197 348H256M197 362H260" stroke="${amber}" stroke-width="6" stroke-linecap="round"/>` +
    `<path ${id("triangle-a")} class="lg-triangle" d="M1045 406L1068 449H1022Z" fill="${amber}" stroke="${amber}" stroke-width="6" stroke-linejoin="round"/>`;

  if (variant === "wordmark") return edge + letters + accents;

  const phrases = SITE_CONFIG.brand.tagline.toUpperCase().split(/(?<=\.)\s+/);
  const tagline =
    `<g ${id("tagline")} class="lg-tagline" fill="${ink}" font-family="Inter,system-ui,sans-serif" font-size="37">` +
    phrases
      .map((p, i) => {
        const [x, w] = PHRASE_BOXES[i] ?? PHRASE_BOXES[0];
        return `<text ${id(`tagline-${i + 1}`)} class="lg-phrase" style="--i:${i}" x="${x}" y="521" textLength="${w}" lengthAdjust="spacing">${p}</text>`;
      })
      .join("") +
    `</g>`;
  return edge + letters + accents + tagline;
}

/** A standalone SVG document (favicon and the raster script). */
export function logoSvgDocument(variant: LogoVariant, tone: LogoTone, prefix = "lg", attrs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[variant]}" role="img" aria-label="${LOGO_LABEL}"${attrs ? ` ${attrs}` : ""}>${buildLogo(variant, tone, prefix)}</svg>`;
}
