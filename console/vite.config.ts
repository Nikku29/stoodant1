import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import viteReact from "@vitejs/plugin-react";

const sitePublic = path.resolve(import.meta.dirname, "../public");

/** Serves (dev) and copies (build) folders of the website's public/ that the shared code uses, e.g. the mascot. */
function shareSiteFiles(folders: string[]): Plugin {
  const files = folders.flatMap((dir) =>
    readdirSync(path.join(sitePublic, dir)).map((name) => `${dir}/${name}`),
  );
  return {
    name: "stoodant-share-site-files",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url?.split("?")[0]?.slice(1);
        if (!file || !files.includes(file)) return next();
        res.setHeader("Content-Type", file.endsWith(".webp") ? "image/webp" : "application/octet-stream");
        res.end(readFileSync(path.join(sitePublic, file)));
      });
    },
    generateBundle() {
      for (const file of files)
        this.emitFile({ type: "asset", fileName: file, source: readFileSync(path.join(sitePublic, file)) });
    },
  };
}

// app.stoodant.com: the parent, teacher and team app. A plain single-page app built from this folder,
// reusing the dashboard code in ../src. Kept apart from the website build so nothing here can add weight
// to the landing page, and so each can be released on its own.
//   dev:   bun run dev:app      build: bun run build:app   (output in console/dist)
export default defineConfig({
  root: import.meta.dirname,
  envDir: path.resolve(import.meta.dirname, ".."),
  plugins: [viteReact(), shareSiteFiles(["mascot"])],
  define: { "import.meta.env.VITE_CONSOLE": JSON.stringify("1") },
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "../src") },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  server: { port: 8081 },
  preview: { host: "127.0.0.1", port: 4174 },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
    minify: "oxc",
    rolldownOptions: {
      treeshake: { manualPureFunctions: ["console.log"] },
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "firebase", test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
          ],
        },
      },
    },
  },
});
