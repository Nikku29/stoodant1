import { SITE_CONFIG } from "@/config/siteConfig";

/** Head tags for an info or blog page: title, description, canonical and share tags. */
export function pageHead(page: { path: string; title: string; description: string }, type?: "article") {
  const url = `${SITE_CONFIG.siteUrl}${page.path}`;
  return {
    meta: [
      { title: page.title },
      { name: "description", content: page.description },
      { property: "og:title", content: page.title },
      { property: "og:description", content: page.description },
      { property: "og:url", content: url },
      ...(type ? [{ property: "og:type", content: type }] : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
