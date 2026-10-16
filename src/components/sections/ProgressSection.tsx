import { m } from "framer-motion";
import { SITE_CONFIG } from "@/config/siteConfig";
import { Counter, Reveal } from "@/lib/directional-reveal";
import { EASE, SectionHeading } from "@/components/sections/shared";

export default function ProgressSection() {
  return <section className="progress-section section-light"><div className="container"><SectionHeading kicker={SITE_CONFIG.progress.kicker}>{SITE_CONFIG.progress.headline}</SectionHeading><Reveal className="dashboard"><div className="dashboard-top"><strong>{SITE_CONFIG.progress.week}</strong><span>{SITE_CONFIG.progress.sample}</span></div><div className="rings">{SITE_CONFIG.progress.rings.map((ring) => <ProgressRing key={ring.label} {...ring} />)}</div><div className="dashboard-lower"><div className="bar-chart">{SITE_CONFIG.progress.bars.map((bar, i) => <div key={i}><m.i variants={{ hidden: { scaleY: 0 }, visible: { scaleY: 1, transition: { delay: i * .08, duration: .8, ease: EASE } } }} style={{ height: `${bar}%` }} /><span>{SITE_CONFIG.progress.days[i]}</span></div>)}</div><div className="report-card"><span>01 / 01</span><h3>{SITE_CONFIG.progress.reportTitle}</h3><p>{SITE_CONFIG.progress.reportCopy}</p></div></div></Reveal></div></section>;
}

function ProgressRing({ label, value }: { label: string; value: number }) { return <div className="ring-item"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42"/><m.circle className="ring-value" cx="50" cy="50" r="42" variants={{ hidden: { pathLength: 0 }, visible: { pathLength: value / 100, transition: { duration: 1.3, ease: EASE } } }} /></svg><strong><Counter value={value} />%</strong><span>{label}</span></div>; }
