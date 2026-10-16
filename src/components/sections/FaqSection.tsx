import { AnimatePresence, m } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { EASE, SectionHeading } from "@/components/sections/shared";

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return <section id="faq" className="faq-section section-light"><div className="container faq-grid"><SectionHeading kicker={SITE_CONFIG.faq.kicker}>{SITE_CONFIG.faq.headline}</SectionHeading><div className="accordion">{SITE_CONFIG.faq.items.map((item, i) => <div className="faq-item" key={item.q}><button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}><span>{item.q}</span><ChevronDown className={open === i ? "rotated" : ""} /></button><AnimatePresence initial={false}>{open === i && <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .35, ease: EASE }}><p>{item.a}</p></m.div>}</AnimatePresence></div>)}</div></div></section>;
}
