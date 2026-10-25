import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { BRAND_CSS } from "@/brand/brandCss";
import { App } from "./App";
import "./console.css";

// Logo and mascot styles, the same rules stoodant.com inlines in its pages.
const brand = document.createElement("style");
brand.textContent = BRAND_CSS;
document.head.append(brand);
// The website's splash plays only on its home page; the app never shows it.
document.documentElement.setAttribute("data-splash", "off");

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker makes the app installable and receives push notifications.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
