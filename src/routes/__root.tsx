import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  lazyRouteComponent,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";

import appCss from "../styles.css?url";
import heroFont from "@fontsource/sora/files/sora-latin-800-normal.woff2?url";
import { BRAND_CSS, HEAD_SCRIPT } from "../brand/brandCss";
import { Splash } from "../brand/Splash";
import { SITE_CONFIG } from "../config/siteConfig";

// The not-found and error pages load only when needed, which keeps them out of the first download.
const NotFoundComponent = lazyRouteComponent(
  () => import("../components/RoutePages"),
  "NotFoundComponent",
);
const ErrorComponent = lazyRouteComponent(
  () => import("../components/RoutePages"),
  "ErrorComponent",
);

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#ffffff" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_CONFIG.brand.name },
      { property: "og:locale", content: "en_IN" },
      { property: "og:image", content: `${SITE_CONFIG.siteUrl}/og-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Stoodant, your class, your pace, your tutor" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_CONFIG.siteUrl}/og-image.png` },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Hero headline font (Sora 800), preloaded so the LCP text renders in its final font.
      { rel: "preload", href: heroFont, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// The browser bundle leaves the head script and brand CSS out (they are large) and reuses the text already in the
// prerendered page, as plain text children. Rendering nothing instead would leave them empty if the head remounts,
// such as after an in-page link.
function headTag(id: string, serverHtml: string) {
  if (import.meta.env.SSR) return { id, dangerouslySetInnerHTML: { __html: serverHtml } };
  return {
    id,
    children:
      typeof document === "undefined" ? "" : (document.getElementById(id)?.textContent ?? ""),
  };
}
const HEAD_SCRIPT_PROPS = headTag("stoodant-head-script", import.meta.env.SSR ? HEAD_SCRIPT : "");
const BRAND_CSS_PROPS = headTag("stoodant-brand-css", import.meta.env.SSR ? BRAND_CSS : "");

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        {/* Runs before first paint: perf tier and splash (see brand/brandCss.ts).
            Both are only in the prerendered HTML; the browser bundle reuses the page's own copy (see headTag). */}
        <script suppressHydrationWarning {...HEAD_SCRIPT_PROPS} />
        <style suppressHydrationWarning {...BRAND_CSS_PROPS} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Splash />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </>
  );
}
