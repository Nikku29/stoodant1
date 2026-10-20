import { createFileRoute } from "@tanstack/react-router";

import { AdminPage } from "@/components/dashboard/AdminPage";

// The Stoodant team's page: demo requests, students, teachers and batches. Google sign-in on /login.
export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Team | Stoodant" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});
