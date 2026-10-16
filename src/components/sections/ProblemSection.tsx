import { PROBLEM_GRAPHICS } from "@/components/ProblemSlides";
import { SITE_CONFIG } from "@/config/siteConfig";
import { AutoStory } from "@/components/AutoStory";
import { SectionHeading } from "@/components/sections/shared";

export default function ProblemSection() {
  const slides = SITE_CONFIG.problem.beats.map((beat) => ({ title: beat.title, ...PROBLEM_GRAPHICS[beat.type]! }));
  return <section className="story-section section-dark problem-slides"><div className="container story-grid"><div><SectionHeading kicker={SITE_CONFIG.problem.kicker} inverse>{SITE_CONFIG.problem.title}</SectionHeading><p className="story-note">{SITE_CONFIG.problem.note}</p></div><AutoStory slides={slides} label="The challenge, in four slides" /></div></section>;
}
