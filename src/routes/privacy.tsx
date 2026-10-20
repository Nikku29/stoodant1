import { createFileRoute } from "@tanstack/react-router";
import { PAGES_META } from "@/config/pagesMeta";
import { PAGES_CONFIG } from "@/config/pagesConfig";
import { pageHead } from "@/seo/pageHead";
import { InfoPage } from "@/components/info/InfoPage";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead(PAGES_META.privacy),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <InfoPage page={PAGES_CONFIG.privacy} path={PAGES_META.privacy.path} showUpdated />;
}
