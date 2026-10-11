import { SITE_CONFIG } from "@/config/siteConfig";

export function isOfferActive(today = new Date()): boolean {
  const { discountPercent, offerLabel, offerEndsOn } = SITE_CONFIG.offer;
  if (discountPercent <= 0 || offerLabel.trim().length === 0) return false;
  if (!offerEndsOn) return true;
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return localDate <= offerEndsOn;
}

export function getPrice(basePrice: number) {
  const original = basePrice;
  const final = isOfferActive()
    ? Math.round(basePrice * (1 - SITE_CONFIG.offer.discountPercent / 100))
    : basePrice;
  return { original, final, saved: original - final };
}

export function formatINR(value: number): string {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

export function getOfferText(): string {
  if (!isOfferActive()) return "";
  const { offerLabel, discountPercent, offerEndsOn } = SITE_CONFIG.offer;
  const ending = offerEndsOn
    ? ` · Ends ${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${offerEndsOn}T00:00:00Z`))}`
    : "";
  return `${offerLabel}: ${discountPercent}% OFF${ending}`;
}
