// Structured data (schema.org JSON-LD) for the home page, built only from siteConfig so it always matches the visible page.
import { SITE_CONFIG } from "@/config/siteConfig";
import { getPrice } from "@/lib/pricing";
import { faqAnswer } from "@/lib/faq";

const site = SITE_CONFIG.siteUrl;
const ORG_ID = `${site}/#organization`;
const description = SITE_CONFIG.faq.items[0]?.a ?? SITE_CONFIG.hero.subhead;

const founderOf = (id: string) => SITE_CONFIG.founders.find((founder) => founder.id === id);

function teacherPerson(teacher: (typeof SITE_CONFIG.teachers.slides)[number]) {
  const founder = founderOf(teacher.id);
  return {
    "@type": "Person",
    "@id": `${site}/#${teacher.id}`,
    name: teacher.name,
    jobTitle: teacher.role ?? `${teacher.subject} teacher`,
    description: teacher.highlights.join(", "),
    ...(teacher.subject ? { knowsAbout: teacher.subject } : {}),
    ...(teacher.photo ? { image: `${site}/teachers/${teacher.photo}-720.webp` } : {}),
    ...(founder ? { sameAs: [founder.linkedin] } : {}),
    worksFor: { "@id": ORG_ID },
  };
}

export function homeJsonLd() {
  const teacherIds = new Set<string>(SITE_CONFIG.teachers.slides.map((teacher) => teacher.id));
  // Founders who are not on the teachers ring get their own Person entry.
  const otherFounders = SITE_CONFIG.founders.filter((founder) => !teacherIds.has(founder.id)).map((founder) => ({
    "@type": "Person",
    "@id": `${site}/#${founder.id}`,
    name: founder.name,
    jobTitle: founder.jobTitle,
    sameAs: [founder.linkedin],
    worksFor: { "@id": ORG_ID },
  }));
  const graph = [
    {
      "@type": "EducationalOrganization",
      "@id": ORG_ID,
      name: SITE_CONFIG.brand.name,
      url: `${site}/`,
      logo: `${site}/apple-touch-icon.png`,
      image: `${site}/og-image.png`,
      slogan: SITE_CONFIG.brand.tagline,
      description,
      email: SITE_CONFIG.contact.email,
      telephone: SITE_CONFIG.contact.phone.replace(/\s/g, ""),
      areaServed: { "@type": "Country", name: "India" },
      knowsAbout: [...SITE_CONFIG.subjects.rowOne, "CBSE", "ICSE", "Online tuition", "Class 4 to 10"],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: SITE_CONFIG.contact.phone.replace(/\s/g, ""),
        email: SITE_CONFIG.contact.email,
        areaServed: "IN",
      },
      founder: SITE_CONFIG.founders.map((founder) => ({ "@id": `${site}/#${founder.id}` })),
      sameAs: SITE_CONFIG.social.map((profile) => profile.href),
      employee: SITE_CONFIG.teachers.slides.map((teacher) => ({ "@id": `${site}/#${teacher.id}` })),
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Online tuition batches",
        itemListElement: SITE_CONFIG.batches.map((batch) => ({
          "@type": "Offer",
          name: `${batch.ratio} ${batch.name} batch`,
          description: SITE_CONFIG.pricing.details[batch.id].bestFor,
          price: getPrice(batch.basePrice).final,
          priceCurrency: "INR",
          ...(SITE_CONFIG.offer.offerEndsOn ? { priceValidUntil: SITE_CONFIG.offer.offerEndsOn } : {}),
          priceSpecification: { "@type": "UnitPriceSpecification", price: getPrice(batch.basePrice).final, priceCurrency: "INR", unitText: "per student per month" },
          itemOffered: {
            "@type": "Service",
            name: `Online tuition, ${batch.ratio} batch`,
            serviceType: "Online tuition for Class 4 to 10 (CBSE and ICSE)",
            provider: { "@id": ORG_ID },
          },
        })),
      },
    },
    ...SITE_CONFIG.teachers.slides.map(teacherPerson),
    ...otherFounders,
    {
      "@type": "WebSite",
      "@id": `${site}/#website`,
      name: SITE_CONFIG.brand.name,
      url: `${site}/`,
      inLanguage: "en-IN",
      publisher: { "@id": ORG_ID },
    },
    {
      "@type": "FAQPage",
      "@id": `${site}/#faq`,
      mainEntity: SITE_CONFIG.faq.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: faqAnswer(item.a) },
      })),
    },
  ];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}
