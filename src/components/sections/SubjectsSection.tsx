import { SITE_CONFIG } from "@/config/siteConfig";
import { SectionHeading } from "@/components/sections/shared";

export default function SubjectsSection() {
  return <section id="subjects" className="subjects-section section-dark"><div className="container"><SectionHeading kicker={SITE_CONFIG.subjects.kicker} inverse>{SITE_CONFIG.subjects.headline}</SectionHeading></div><Marquee values={SITE_CONFIG.subjects.rowOne} /><Marquee values={SITE_CONFIG.subjects.rowTwo} reverse /></section>;
}

function Marquee({ values, reverse = false }: { values: readonly string[]; reverse?: boolean }) { const doubled = [...values, ...values]; return <div className="marquee"><div className={reverse ? "marquee-track reverse" : "marquee-track"}>{doubled.map((item, i) => <span key={`${item}-${i}`}>{item}<i /></span>)}</div></div>; }
