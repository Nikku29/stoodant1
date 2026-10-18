import { createFileRoute } from "@tanstack/react-router";

import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { SAMPLE_RECORDS, SAMPLE_TODAY } from "@/lib/progress/sampleData";

// Parent dashboard. Shows sample records until parent logins exist; then the signed-in parent's child.
// Its own route chunk, so none of this code or CSS loads with the landing page.
export const Route = createFileRoute("/parent")({
  head: () => ({
    meta: [{ title: "Your child's progress | Stoodant" }, { name: "robots", content: "noindex" }],
  }),
  component: ParentPage,
});

function ParentPage() {
  return <ParentDashboard records={SAMPLE_RECORDS} today={SAMPLE_TODAY} sample />;
}
