import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "@/components/dashboard/LoginPage";

// Log-in for parents, teachers (mobile number + SMS code) and the Stoodant team (Google).
export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in | Stoodant" }, { name: "robots", content: "noindex" }] }),
  component: LoginPage,
});
