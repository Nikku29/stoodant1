// Dev-only: regenerates public/favicon.svg, apple-touch-icon.png and og-image.png from the logo source.
// Raster output uses a locally installed Chrome/Edge in headless mode, so no npm dependency is needed.
// Run: npm run brand:assets  (set CHROME_PATH if the browser is not in a standard location)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const { buildLogo } = await import(pathToFileURL(join(root, "src/brand/logoMarkup.ts")).href);
const out = (name) => join(root, "public", name);

// Favicon: the eyes ("mark") centred in a square; rings and bridge turn white on dark browser chrome.
const favicon =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="234 -33.5 298 298">` +
  `<style>@media (prefers-color-scheme:dark){[id$=ring-o1],[id$=ring-o2]{stroke:#fff}[id$=bridge]{fill:#fff}}</style>` +
  buildLogo("mark", "light", "f") +
  `</svg>`;
writeFileSync(out("favicon.svg"), favicon);

const chrome = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((path) => path && existsSync(path));
if (!chrome) throw new Error("No Chrome/Edge found; set CHROME_PATH.");

const tmp = mkdtempSync(join(tmpdir(), "stoodant-brand-"));
function shoot(name, width, height, body) {
  const html = join(tmp, `${name}.html`);
  writeFileSync(html, `<!doctype html><html><head><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#fff}body{display:grid;place-items:center}</style></head><body>${body}</body></html>`);
  execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${width},${height}`, `--screenshot=${out(name)}`, pathToFileURL(html).href], { stdio: "ignore" });
  console.log(`${name}: ${(statSync(out(name)).size / 1024).toFixed(1)} KB`);
}

// Apple touch icon: white square, eyes centred with breathing room (iOS rounds the corners).
shoot("apple-touch-icon.png", 180, 180, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="234 43 298 145" width="136">${buildLogo("mark", "light", "a")}</svg>`);
// OG image: full logo with tagline centred on white.
shoot("og-image.png", 1200, 630, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1110 262" width="840">${buildLogo("full", "light", "o")}</svg>`);

rmSync(tmp, { recursive: true, force: true });
console.log("favicon.svg written");
