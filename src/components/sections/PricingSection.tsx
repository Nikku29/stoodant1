import { m } from "framer-motion";
import { ArrowDownRight, Check } from "lucide-react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { formatINR, getPrice, isOfferActive } from "@/lib/pricing";
import { Reveal } from "@/lib/directional-reveal";
import { OfferBadge, SectionHeading } from "@/components/sections/shared";

export default function PricingSection() {
  return <section id="batches" className="pricing-section section-off"><div className="container"><SectionHeading kicker={SITE_CONFIG.pricing.kicker}>{SITE_CONFIG.pricing.heading}</SectionHeading><div className="pricing-intro"><p>{SITE_CONFIG.pricing.subtext}</p><OfferBadge /></div><div className="pricing-grid">{SITE_CONFIG.batches.map((batch) => <PricingCard key={batch.id} batch={batch} />)}</div><p className="pricing-note">{SITE_CONFIG.pricing.note}</p></div></section>;
}

type Batch = (typeof SITE_CONFIG.batches)[number];

function PricingCard({ batch }: { batch: Batch }) {
  const price = getPrice(batch.basePrice); const detail = SITE_CONFIG.pricing.details[batch.id];
  return <Reveal as="article" className={`pricing-card ${batch.popular ? "popular" : ""}`} whileHover={{ y: -6 }} whileTap={{ y: -3 }}>{batch.popular && <span className="ribbon">{SITE_CONFIG.pricing.popular}</span>}<div className="ratio-row"><strong>{batch.ratio}</strong><span>{batch.name}</span></div><div className="price-block">{isOfferActive() && <del>{formatINR(price.original)}</del>}<div><b>{formatINR(price.final)}</b><span>{SITE_CONFIG.pricing.perMonth}</span></div>{isOfferActive() && <em>{SITE_CONFIG.pricing.save} {formatINR(price.saved)}</em>}</div><DotClass students={batch.students} /><p className="best-for">{detail.bestFor}</p><ul>{detail.benefits.map((benefit) => <li key={benefit}><Check size={15} />{benefit}</li>)}</ul><a className={`button ${batch.popular ? "button-light" : "button-dark"}`} href="#demo">{SITE_CONFIG.pricing.button}<ArrowDownRight size={17} /></a></Reveal>;
}

function DotClass({ students }: { students: number }) {
  return <div className="dot-class"><div className="dot-legend"><span><i className="teacher-dot" />{SITE_CONFIG.pricing.teacher}</span><span><i />{SITE_CONFIG.pricing.students}</span></div><div className="dot-field"><i className="teacher-dot" />{Array.from({ length: students }, (_, i) => <m.i key={i} variants={{ hidden: { opacity: 0, scale: 0 }, visible: { opacity: 1, scale: 1, transition: { delay: i * .05 } } }} style={{ animationDelay: `${i * .08}s` }} />)}</div></div>;
}
