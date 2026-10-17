import { createFileRoute } from "@tanstack/react-router";
import { NotFoundComponent } from "./__root";

// Prerendered to 404.html, which Firebase Hosting serves (with a real 404 status) for any unknown URL.
export const Route = createFileRoute("/404")({
  head: () => ({ meta: [{ title: "Page not found | Stoodant" }, { name: "robots", content: "noindex" }] }),
  component: NotFoundComponent,
});
