import { homeJsonLd } from "@/seo/jsonld";

// The JSON is built on the server only, so its code stays out of the browser bundle. The browser reuses the
// text already in the prerendered page (as __root.tsx does for the head script), so hydration keeps it.
const ID = "stoodant-jsonld";
const json = import.meta.env.SSR ? homeJsonLd() : typeof document === "undefined" ? "" : (document.getElementById(ID)?.textContent ?? "");

export function HomeJsonLd() {
  return <script id={ID} type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: json }} />;
}
