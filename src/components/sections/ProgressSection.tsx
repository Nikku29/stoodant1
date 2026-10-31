import { m } from "framer-motion";
import { PROGRESS_SECTION } from "@/config/progressSectionConfig";
import { Counter, Reveal } from "@/lib/directional-reveal";
import { EASE, SectionHeading } from "@/components/sections/shared";

export default function ProgressSection() {
  return <section className="progress-section section-light"><div className="container"><SectionHeading kicker={PROGRESS_SECTION.kicker}>{PROGRESS_SECTION.headline}</SectionHeading><Reveal className="dashboard"><div className="dashboard-top"><strong>{PROGRESS_SECTION.week}</strong><span>{PROGRESS_SECTION.sample}</span></div><div className="rings">{PROGRESS_SECTION.rings.map((ring) => <ProgressRing key={ring.label} {...ring} />)}</div><div className="dashboard-lower"><div className="bar-chart">{PROGRESS_SECTION.bars.map((bar, i) => <div key={i}><m.i variants={{ hidden: { scaleY: 0 }, visible: { scaleY: 1, transition: { delay: i * .08, duration: .8, ease: EASE } } }} style={{ height: `${bar}%` }} /><span>{PROGRESS_SECTION.days[i]}</span></div>)}</div><div className="report-card"><span>01 / 01</span><h3>{PROGRESS_SECTION.reportTitle}</h3><p>{PROGRESS_SECTION.reportCopy}</p></div></div></Reveal></div></section>;
}

function ProgressRing({ label, value }: { label: string; value: number }) { return <div className="ring-item"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42"/><m.circle className="ring-value" cx="50" cy="50" r="42" variants={{ hidden: { pathLength: 0 }, visible: { pathLength: value / 100, transition: { duration: 1.3, ease: EASE } } }} /></svg><strong><Counter value={value} />%</strong><span>{label}</span></div>; }
