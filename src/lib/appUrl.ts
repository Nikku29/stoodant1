// Where the app for parents, teachers and the team lives (app.stoodant.com, the console/ build). Set
// VITE_APP_URL=https://app.stoodant.com on the website's Vercel project once that address works; until then
// log-in and the dashboards stay on this site, exactly as before.
// Written out as import.meta.env.NAME so Vite inlines just these values, not the whole env object.
export const APP_URL =
  import.meta.env.VITE_CONSOLE === "1" ? "" : (import.meta.env.VITE_APP_URL ?? "").replace(/\/+$/, "");

/** A link to a page of the app: on the app's own address when it is set up, else on this site. */
export const appHref = (path: string) => APP_URL + path;

declare global {
  interface ImportMetaEnv {
    readonly VITE_APP_URL?: string;
    readonly VITE_CONSOLE?: string;
  }
}
