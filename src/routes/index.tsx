import { createFileRoute } from "@tanstack/react-router";
import { StoodantLanding } from "@/components/StoodantLanding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stoodant | Personalised Tuition for Class 4-10 (CBSE & ICSE)" },
      { name: "description", content: "Personalised tuition for Class 4 to 10 students in CBSE and ICSE, with batch sizes from 1:1 to 1:20." },
      { property: "og:title", content: "Stoodant | Personalised Tuition for Class 4-10 (CBSE & ICSE)" },
      { property: "og:description", content: "Small batches, real attention, and learning that moves at your child's pace." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

function Index() {
  return <StoodantLanding />;
}
