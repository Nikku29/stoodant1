import { useEffect } from "react";

import { APP_URL } from "./appUrl";

/** On the website, moves /login, /parent, /teacher and /admin (with their ?query) to the app, once it is set up. */
export function useMoveToApp() {
  useEffect(() => {
    if (APP_URL && location.origin !== APP_URL) location.replace(APP_URL + location.pathname + location.search + location.hash);
  }, []);
}
