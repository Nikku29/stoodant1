import { SITE_CONFIG } from "@/config/siteConfig";
import { TeachersRing } from "@/components/TeachersRing";
import { SectionHeading } from "@/components/sections/shared";

export default function TeachersSection() {
  return <section className="teachers-section eclipse-section"><div className="container"><SectionHeading kicker={SITE_CONFIG.teachers.kicker} inverse>{SITE_CONFIG.teachers.headline}</SectionHeading></div><div className="tr-reveal"><TeachersRing /></div></section>;
}
