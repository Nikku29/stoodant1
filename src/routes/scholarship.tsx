import { createFileRoute } from "@tanstack/react-router";
import { SITE_CONFIG } from "@/config/siteConfig";
import { PAGES_META } from "@/config/pagesMeta";
import { pageHead } from "@/seo/pageHead";
import { ScholarshipPage } from "@/components/scholarship/ScholarshipPage";

const meta = PAGES_META.scholarship;

export const Route = createFileRoute("/scholarship")({
  head: () => {
    const head = pageHead(meta);
    const image = `${SITE_CONFIG.siteUrl}/og-scholarship.png`;
    // Its own share picture, so a WhatsApp or Instagram link to this page shows the campaign poster.
    return { ...head, meta: [...head.meta, { property: "og:image", content: image }, { name: "twitter:image", content: image }] };
  },
  component: ScholarshipPage,
});
