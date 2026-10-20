// Small building blocks shared by the hero and the lazily loaded sections.
import { m } from "framer-motion";
import { SITE_CONFIG } from "@/config/siteConfig";
import { getOfferText, isOfferActive } from "@/lib/pricing";
import { Reveal } from "@/lib/directional-reveal";
import { Logo } from "@/brand/Logo";
import { LOGO_LABEL } from "@/brand/logoMarkup";

export const EASE = [0.22, 1, 0.36, 1] as const;

export const reveal = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } } };

export const GROUP = { hidden: {}, visible: {} };

/** Home link around the brand logo. In the navbar: full lockup, wordmark below 480px, pupils follow the pointer. */
export function BrandLink({ dark = false, nav = false }: { dark?: boolean; nav?: boolean }) {
  const tone = dark ? "dark" : "light";
  return (
    <a href="#top" className={nav ? "logo logo-nav" : "logo"} aria-label={`${LOGO_LABEL}. Home`}>
      {nav ? (
        <>
          <Logo tone={tone} animate="blink" follow className="logo-full" />
          <Logo variant="wordmark" tone={tone} animate="blink" follow className="logo-compact" />
        </>
      ) : <Logo tone={tone} />}
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

