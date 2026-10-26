import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/seo/pageHead";
import { BlogIndexPage } from "@/components/blog/BlogPages";

// Head data comes from the loader, so the blog's text loads with the blog pages only, never with the landing page.
export const Route = createFileRoute("/blog/")({
  loader: () => import("@/content/blog").then(({ BLOG }) => ({ path: BLOG.path, title: BLOG.title, description: BLOG.description })),
  head: ({ loaderData }) => (loaderData ? pageHead(loaderData) : {}),
  component: BlogIndexPage,
});
