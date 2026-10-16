import { SITE_CONFIG } from "@/config/siteConfig";
import { ProcessSequence } from "@/components/ProcessSequence";
import { SectionHeading } from "@/components/sections/shared";

export default function ProcessSection() {
  return <section id="how-it-works" className="process-section section-light"><div className="container"><SectionHeading kicker={SITE_CONFIG.process.kicker}>{SITE_CONFIG.process.headline}</SectionHeading><ProcessSequence /></div></section>;
}
