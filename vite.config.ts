// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Keep large libraries in their own long-cached chunks. A group only bundles what is already
// reachable from where it is used, so three.js stays lazy (Final CTA only). Shared dependencies are not
// pulled into a group (includeDependenciesRecursively: false), otherwise the initial chunk would import three.
const vendorChunks = [
  { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
  // The animation features that <LazyMotion> loads later are left out, so they stay out of the initial load.
  { name: "framer-motion", test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/](?!.*(features|gestures))/ },
  { name: "gsap", test: /node_modules[\\/]gsap[\\/]/ },
  { name: "three", test: /node_modules[\\/](three|three-stdlib|@react-three|@monogrid)[\\/]/ },
];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    prerender: { enabled: true, crawlLinks: true },
    pages: [{ path: "/404", prerender: { enabled: true, outputPath: "/404.html" } }],
  },
  vite: {
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
  },
});
