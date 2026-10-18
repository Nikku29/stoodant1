import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

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
      prerender: { enabled: true, crawlLinks: true },
      pages: [{ path: "/404", prerender: { enabled: true, outputPath: "/404.html" } }],
    }),
    viteReact(),
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
