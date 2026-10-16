import { SITE_CONFIG } from "@/config/siteConfig";
import { AutoStory } from "@/components/AutoStory";
import { AHEAD_SLIDES } from "@/components/AheadSlides";
import { Reveal } from "@/lib/directional-reveal";
import { SectionHeading } from "@/components/sections/shared";

export default function AheadSection() {
  return <section className="story-section section-dark ahead-slides"><div className="container story-grid"><div><SectionHeading kicker={SITE_CONFIG.ahead.kicker} inverse>{SITE_CONFIG.ahead.headline}</SectionHeading><Reveal as="p" className="story-note">{SITE_CONFIG.ahead.explanation}</Reveal></div><AutoStory slides={AHEAD_SLIDES} label="Stay ahead, in three slides" /></div></section>;
}
