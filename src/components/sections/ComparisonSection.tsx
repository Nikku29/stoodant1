import { Check } from "lucide-react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { Reveal } from "@/lib/directional-reveal";
import { EASE, SectionHeading } from "@/components/sections/shared";
import { AntTrail } from "@/brand/AntTrail";

export default function ComparisonSection() {
  return <section id="why-stoodant" className="comparison-section section-light"><div className="container"><SectionHeading kicker={SITE_CONFIG.comparison.kicker}>{SITE_CONFIG.comparison.headline}</SectionHeading><div className="comparison-table"><div className="comparison-head"><span>{SITE_CONFIG.comparison.columns[0]}</span><strong>{SITE_CONFIG.comparison.columns[1]}</strong></div>{SITE_CONFIG.comparison.rows.map((row, i) => <Reveal className="comparison-row" key={row[0]} variants={{ hidden: { opacity: 0, x: -40 }, visible: { opacity: 1, x: 0, transition: { delay: i * .08, duration: .8, ease: EASE } } }}><span>{row[0]}</span><strong><Check />{row[1]}</strong></Reveal>)}</div></div><AntTrail /></section>;
}
