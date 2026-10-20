import { describe, expect, it } from "vitest";
import { SITE_CONFIG } from "@/config/siteConfig";
import { faqAnswer } from "@/lib/faq";
import { homeJsonLd } from "@/seo/jsonld";
import { llmsTxt, robotsTxt, sitemapXml } from "@/seo/files";

describe("SEO output", () => {
  it("fills every FAQ placeholder", () => {
    for (const item of SITE_CONFIG.faq.items) expect(faqAnswer(item.a)).not.toMatch(/[{}]/);
  });

  it("builds valid JSON-LD with the organisation, website and every FAQ answer", () => {
    const data = JSON.parse(homeJsonLd()) as { "@graph": { "@type": string; mainEntity?: { acceptedAnswer: { text: string } }[] }[] };
    const types = data["@graph"].map((node) => node["@type"]);
    expect(types).toEqual(expect.arrayContaining(["EducationalOrganization", "WebSite", "FAQPage", "Person"]));
    const faq = data["@graph"].find((node) => node["@type"] === "FAQPage");
    expect(faq?.mainEntity?.map((q) => q.acceptedAnswer.text)).toEqual(SITE_CONFIG.faq.items.map((item) => faqAnswer(item.a)));
  });

  it("points robots.txt at the sitemap and keeps private pages out of it", () => {
    expect(robotsTxt()).toContain(`Sitemap: ${SITE_CONFIG.siteUrl}/sitemap.xml`);
    expect(sitemapXml()).not.toMatch(/login|parent|teacher|admin/);
    expect(llmsTxt()).toContain(SITE_CONFIG.contact.phone);
  });
});
