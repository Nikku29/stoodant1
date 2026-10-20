import { createFileRoute } from "@tanstack/react-router";
import { StoodantLanding, preloadLandingSections } from "@/components/StoodantLanding";
import { SITE_CONFIG } from "@/config/siteConfig";
import { formatINR, getPrice } from "@/lib/pricing";
import { HomeJsonLd } from "@/seo/JsonLd";

// The brand name leads the title so a search for "Stoodant" matches it; "online tuition" is what parents search for.
const TITLE = "Stoodant | Online Tuition for Class 4-10 (CBSE & ICSE)";
const fromPrice = formatINR(Math.min(...SITE_CONFIG.batches.map((batch) => getPrice(batch.basePrice).final)));
const DESCRIPTION = `Stoodant offers live online tuition for Class 4-10 (CBSE & ICSE) in small batches from 1:1 to 1:20, from ${fromPrice} a month. Book a free demo class.`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_CONFIG.siteUrl}/` },
    ],
    links: [{ rel: "canonical", href: `${SITE_CONFIG.siteUrl}/` }],
  }),
  loader: () => preloadLandingSections(),
  component: Index,
});

function Index() {
  return (
    <>
      <HomeJsonLd />
      <StoodantLanding />
    </>
  );
}
