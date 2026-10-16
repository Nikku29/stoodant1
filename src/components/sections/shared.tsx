// Small building blocks shared by the hero and the lazily loaded sections.
import { m } from "framer-motion";
import { SITE_CONFIG } from "@/config/siteConfig";
import { getOfferText, isOfferActive } from "@/lib/pricing";
import { Reveal } from "@/lib/directional-reveal";

export const EASE = [0.22, 1, 0.36, 1] as const;

export const reveal = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } } };

export const GROUP = { hidden: {}, visible: {} };

export function Logo({ inverse = false }: { inverse?: boolean }) {
  const color = inverse ? "var(--white)" : "var(--ink)";
  return (
    <a href="#top" className="logo" aria-label={`${SITE_CONFIG.brand.name} home`}>
      <svg viewBox="0 0 194 30" role="img" aria-label={SITE_CONFIG.brand.name}>
        <text x="0" y="24" fill={color} className="logo-text">ST</text>
        <path d="M40 15c8-15 20-15 28 0 8 15 20 15 28 0C88 0 76 0 68 15 60 30 48 30 40 15Z" fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="101" y="24" fill={color} className="logo-text">DANT</text>
      </svg>
      <span>{SITE_CONFIG.brand.tagline}</span>
    </a>
  );
}

export function OfferBadge() {
  if (!isOfferActive()) return null;
  return <span className="offer-badge">{getOfferText()}</span>;
}

export function SectionHeading({ kicker, children, inverse = false }: { kicker: string; children: string; inverse?: boolean }) {
  return <Reveal className={`section-heading ${inverse ? "inverse" : ""}`} variants={GROUP}><m.span variants={reveal}>{kicker}</m.span><h2>{children.split(" ").map((word, i) => <span className="word-mask" key={`${word}-${i}`}><m.i variants={{ hidden: { y: "115%" }, visible: { y: 0, transition: { duration: .8, delay: i * .08, ease: EASE } } }}>{word}&nbsp;</m.i></span>)}</h2></Reveal>;
}

export function Divider({ inverse = false }: { inverse?: boolean }) { return <div className={`divider ${inverse ? "inverse" : ""}`}><svg viewBox="0 0 130 54"><path d="M7 27C22 2 44 2 65 27s43 25 58 0C108 2 86 2 65 27S22 52 7 27Z" /></svg></div>; }
