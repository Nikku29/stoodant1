import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "@/seo/pageHead";
import { BlogPostPage } from "@/components/blog/BlogPages";

// Head data comes from the loader, so the blog's text loads with the blog pages only, never with the landing page.
export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { findBlogPost, blogPostPath } = await import("@/content/blog");
    const post = findBlogPost(params.slug);
    if (!post) throw notFound();
    return { post, path: blogPostPath(post.slug) };
  },
  head: ({ loaderData }) => (loaderData ? pageHead({ path: loaderData.path, title: loaderData.post.title, description: loaderData.post.description }, "article") : {}),
  component: BlogPostRoute,
});

function BlogPostRoute() {
  const { post } = Route.useLoaderData();
  return <BlogPostPage post={post} />;
}
