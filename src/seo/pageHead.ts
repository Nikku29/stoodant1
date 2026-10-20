import { SITE_CONFIG } from "@/config/siteConfig";
import type { PageMeta } from "@/config/pagesMeta";

/** Head tags for an info page: title, description, canonical and share tags. */
export function pageHead(page: PageMeta) {
  const url = `${SITE_CONFIG.siteUrl}${page.path}`;
  return {
    meta: [
      { title: page.title },
      { name: "description", content: page.description },
      { property: "og:title", content: page.title },
      { property: "og:description", content: page.description },
      { property: "og:url", content: url },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
