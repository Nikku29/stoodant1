// Text files written next to the prerendered pages at build time (see the stoodant-seo-files plugin in vite.config.ts).
// Relative imports: vite.config.ts loads this module, and path aliases do not apply there.
import { SITE_CONFIG } from "../config/siteConfig";
import { faqAnswer } from "../lib/faq";
import { formatINR, getPrice } from "../lib/pricing";

const site = SITE_CONFIG.siteUrl;

/** Pages search engines should index. /login, /parent, /teacher and /admin are private and stay out. */
const INDEXED_PATHS = ["/"];

export function robotsTxt() {
  return `# Search engines and AI answer tools are welcome. The log-in pages are left crawlable on purpose:
# they send "noindex", which crawlers can only see if they are allowed to fetch them.
User-agent: *
Allow: /

Sitemap: ${site}/sitemap.xml
`;
}

export function sitemapXml(today = new Date().toISOString().slice(0, 10)) {
  const urls = INDEXED_PATHS.map((path) => `  <url><loc>${site}${path}</loc><lastmod>${today}</lastmod></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** A plain summary for AI assistants (llmstxt.org format), from the same config as the page. */
export function llmsTxt() {
  const teachers = SITE_CONFIG.teachers.slides
    .map((t) => `- ${t.name}, ${t.role ?? `${t.subject} teacher`}: ${t.highlights.join(", ")}`)
    .join("\n");
  const batches = SITE_CONFIG.batches
    .map((b) => `- ${b.ratio} ${b.name}: ${formatINR(getPrice(b.basePrice).final)} per student per month. ${SITE_CONFIG.pricing.details[b.id].bestFor}`)
    .join("\n");
  const faq = SITE_CONFIG.faq.items.map((item) => `### ${item.q}\n${faqAnswer(item.a)}`).join("\n\n");
  return `# ${SITE_CONFIG.brand.name}

> ${faqAnswer(SITE_CONFIG.faq.items[0]?.a ?? SITE_CONFIG.hero.subhead)}

Tagline: ${SITE_CONFIG.brand.tagline}
Website: ${site}/
Phone and WhatsApp: ${SITE_CONFIG.contact.phone}
Email: ${SITE_CONFIG.contact.email}
${SITE_CONFIG.social.map((profile) => `${profile.label}: ${profile.href}`).join("\n")}

## Founders
${SITE_CONFIG.founders.map((founder) => `- ${founder.name}, ${founder.jobTitle} (LinkedIn: ${founder.linkedin})`).join("\n")}

## Key facts
- Classes: ${SITE_CONFIG.form.classes[0]} to ${SITE_CONFIG.form.classes.at(-1)}
- Boards: ${SITE_CONFIG.form.boards.join(" and ")}
- Subjects: ${SITE_CONFIG.subjects.rowOne.join(", ")}
- Format: online, live classes on Zoom or Google Meet
- Batch sizes: ${SITE_CONFIG.batches.map((b) => b.ratio).join(", ")} (teacher to students)
- Every batch starts with a free demo class: ${site}/#demo

## Batches and fees
${batches}
${SITE_CONFIG.pricing.note}

## Teachers
${teachers}

## How it works
${SITE_CONFIG.process.steps.map((s) => `${s.number}. ${s.title}: ${s.copy}`).join("\n")}

## FAQ
${faq}
`;
}
