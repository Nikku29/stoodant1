import { createFileRoute } from "@tanstack/react-router";

import { TeacherPage } from "@/components/dashboard/pages/TeacherPage";

// Teacher entry page for attendance, marks and notes.
export const Route = createFileRoute("/teacher")({
  head: () => ({ meta: [{ title: "Teacher | Stoodant" }, { name: "robots", content: "noindex" }] }),
  component: TeacherPage,
});
