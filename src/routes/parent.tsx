import { createFileRoute } from "@tanstack/react-router";

import { ParentPage } from "@/components/dashboard/pages/ParentPage";

// Parent dashboard. Its own route chunk, so none of this code or CSS loads with the landing page.
export const Route = createFileRoute("/parent")({
  head: () => ({
    meta: [{ title: "Your child's progress | Stoodant" }, { name: "robots", content: "noindex" }],
  }),
  component: ParentPage,
});
