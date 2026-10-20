import { createFileRoute } from "@tanstack/react-router";

import { TeacherEntry } from "@/components/dashboard/TeacherEntry";
import { SAMPLE_BATCH } from "@/lib/progress/sampleData";

// Teacher entry page for attendance, marks and notes. Practice mode with a sample batch until teacher logins exist.
export const Route = createFileRoute("/teacher")({
  head: () => ({ meta: [{ title: "Teacher | Stoodant" }, { name: "robots", content: "noindex" }] }),
  component: TeacherPage,
});

function TeacherPage() {
  return <TeacherEntry batch={SAMPLE_BATCH} />;
}
