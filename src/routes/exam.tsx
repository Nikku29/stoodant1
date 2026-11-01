import { createFileRoute } from "@tanstack/react-router";
import { ExamPage } from "@/components/scholarship/ExamPage";

// The scholarship test itself (roll number + date of birth, only inside the booked hour). ExamPage sends its own
// noindex tag: a head() here would sit in the home page's first download, which has no room to spare.
export const Route = createFileRoute("/exam")({ component: ExamPage });
