import { createFileRoute } from "@tanstack/react-router";
import { PAGES_META } from "@/config/pagesMeta";
import { PAGES_CONFIG } from "@/config/pagesConfig";
import { pageHead } from "@/seo/pageHead";
import { InfoPage } from "@/components/info/InfoPage";

export const Route = createFileRoute("/terms")({
  head: () => pageHead(PAGES_META.terms),
  component: TermsPage,
});

function TermsPage() {
  return <InfoPage page={PAGES_CONFIG.terms} path={PAGES_META.terms.path} showUpdated />;
}
