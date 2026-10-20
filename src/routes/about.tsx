import { createFileRoute } from "@tanstack/react-router";
import { PAGES_META } from "@/config/pagesMeta";
import { pageHead } from "@/seo/pageHead";
import { AboutPage } from "@/components/info/AboutPage";

export const Route = createFileRoute("/about")({
  head: () => pageHead(PAGES_META.about),
  component: AboutPage,
});
