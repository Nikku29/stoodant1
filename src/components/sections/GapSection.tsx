import { m } from "framer-motion";
import { SITE_CONFIG } from "@/config/siteConfig";
import { Reveal } from "@/lib/directional-reveal";
import { GROUP, SectionHeading } from "@/components/sections/shared";
import { AntTrail } from "@/brand/AntTrail";

export default function GapSection() {
  return <section className="gap-section section-off"><div className="container"><SectionHeading kicker={SITE_CONFIG.gap.kicker}>{SITE_CONFIG.gap.headline}</SectionHeading><div className="gap-copy">{SITE_CONFIG.gap.paragraphs.map((p) => <Reveal as="p" key={p}>{p}</Reveal>)}</div><Reveal className="class-timeline" variants={GROUP}>{SITE_CONFIG.gap.classes.map((grade, i) => <m.div key={grade} variants={{ hidden: { opacity: .15 }, visible: { opacity: 1, transition: { delay: i * .14, duration: .5 } } }}><span>{grade}</span></m.div>)}<div className="beyond"><small>{SITE_CONFIG.gap.focus}</small><strong>{SITE_CONFIG.gap.beyond}</strong></div></Reveal></div><AntTrail /></section>;
}
