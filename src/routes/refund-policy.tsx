import { createFileRoute } from "@tanstack/react-router";
import { PAGES_META } from "@/config/pagesMeta";
import { PAGES_CONFIG } from "@/config/pagesConfig";
import { pageHead } from "@/seo/pageHead";
import { InfoPage } from "@/components/info/InfoPage";

export const Route = createFileRoute("/refund-policy")({
  head: () => pageHead(PAGES_META.refund),
  component: RefundPage,
});

function RefundPage() {
  return <InfoPage page={PAGES_CONFIG.refund} path={PAGES_META.refund.path} showUpdated />;
}
