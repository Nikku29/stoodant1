import { homeJsonLd } from "@/seo/jsonld";

// The JSON is built on the server only, so its code stays out of the browser bundle. The browser reuses the
// text already in the prerendered page as plain text children (as __root.tsx does for the head script), so
// hydration keeps it and nothing is parsed as HTML.
const ID = "stoodant-jsonld";

export function HomeJsonLd() {
  if (import.meta.env.SSR) return <script id={ID} type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd() }} />;
  const json = typeof document === "undefined" ? "" : (document.getElementById(ID)?.textContent ?? "");
  return <script id={ID} type="application/ld+json" suppressHydrationWarning>{json}</script>;
}
