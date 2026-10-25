import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { llmsTxt, robotsTxt, sitemapXml } from "./src/seo/files";

// robots.txt, sitemap.xml and llms.txt are generated from siteConfig, so they never drift from the page.
function seoFiles(): Plugin {
  return {
    name: "stoodant-seo-files",
    generateBundle() {
      if (this.environment.name !== "client") return;
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robotsTxt() });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemapXml() });
      this.emitFile({ type: "asset", fileName: "llms.txt", source: llmsTxt() });
    },
  };
}

// Keep large libraries in their own long-cached chunks. A group only bundles what is already
// reachable from where it is used. Shared dependencies are not pulled into a group
// (includeDependenciesRecursively: false), so a lazy chunk never drags its dependencies into the initial load.
const vendorChunks = [
  { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
  // The animation features that <LazyMotion> loads later are left out, so they stay out of the initial load.
  { name: "framer-motion", test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/](?!.*(features|gestures))/ },
  { name: "gsap", test: /node_modules[\\/]gsap[\\/]/ },
];

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      // Server-only code must never end up in the browser bundle.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Use src/server.ts (our SSR error wrapper) as the server entry.
      server: { entry: "server" },
      // Every page is rendered to static HTML at build time; Firebase Hosting serves dist/client.
      // In-page links such as /#demo are the home page again, so the crawl skips them.
      prerender: { enabled: true, crawlLinks: true, filter: (page) => !page.path.includes("#") },
      // /parent, /teacher, /login and /admin are not linked from the landing page, so the crawl would miss them.
      pages: [{ path: "/404", prerender: { enabled: true, outputPath: "/404.html" } }, { path: "/parent", prerender: { enabled: true, outputPath: "/parent.html" } }, { path: "/teacher", prerender: { enabled: true, outputPath: "/teacher.html" } }, { path: "/login", prerender: { enabled: true, outputPath: "/login.html" } }, { path: "/admin", prerender: { enabled: true, outputPath: "/admin.html" } }, ...["/about", "/privacy", "/terms", "/refund-policy"].map((path) => ({ path, prerender: { enabled: true, outputPath: `${path}.html` } }))],
    }),
    viteReact(),
    seoFiles(),
  ],
  css: { transformer: "lightningcss" },
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  server: { port: 8080 },
  // The prerender step crawls a preview server. Pin it to IPv4 so "localhost" can't resolve to ::1 in Docker builds.
  preview: { host: "127.0.0.1" },
  environments: {
    client: {
      build: {
        target: "es2020",
        cssCodeSplit: true,
        sourcemap: false,
        // Vite 8 minifies with Oxc (its built-in replacement for esbuild).
        minify: "oxc",
        rolldownOptions: {
          // console.log calls become dead code and are removed; console.error/warn are kept for error reporting.
          treeshake: { manualPureFunctions: ["console.log"] },
          output: {
            minify: { compress: { dropDebugger: true } },
            codeSplitting: { includeDependenciesRecursively: false, groups: vendorChunks },
          },
        },
      },
    },
  },
});
