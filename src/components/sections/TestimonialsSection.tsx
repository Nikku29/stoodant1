import { SITE_CONFIG } from "@/config/siteConfig";
import { Reveal } from "@/lib/directional-reveal";
import { SectionHeading } from "@/components/sections/shared";

export default function TestimonialsSection() { return <section className="testimonials-section section-off"><div className="container"><SectionHeading kicker={SITE_CONFIG.testimonials.kicker}>{SITE_CONFIG.testimonials.headline}</SectionHeading><div className="testimonial-grid">{SITE_CONFIG.testimonials.cards.map((card, i) => <Reveal as="article" key={i}><span>“</span><p>{card}</p><i /></Reveal>)}</div></div></section>; }
