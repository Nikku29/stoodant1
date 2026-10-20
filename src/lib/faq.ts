import { SITE_CONFIG } from "@/config/siteConfig";
import { formatINR, getPrice } from "@/lib/pricing";

const listFormat = new Intl.ListFormat("en-IN", { style: "long", type: "conjunction" });

/** Fills the {prices}, {subjects} and {phone} placeholders in an FAQ answer from the rest of the config. */
export function faqAnswer(answer: string): string {
  return answer
    .replace("{prices}", () => listFormat.format(SITE_CONFIG.batches.map((batch) => `${formatINR(getPrice(batch.basePrice).final)} for ${batch.ratio} ${batch.name}`)))
    .replace("{subjects}", () => listFormat.format(SITE_CONFIG.subjects.rowOne))
    .replace("{phone}", SITE_CONFIG.contact.phone);
}
