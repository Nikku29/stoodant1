// What the roaming ant says when tapped. Kept apart from siteConfig.ts because only the ant uses these lines,
// and the ant's code loads after the page is up; in siteConfig they would add weight to the first download.
// It first picks a line for the section on screen, then general ones (shuffled, no repeats until all are used).
// Keep lines warm and short; no factual claims about ants. TODO(owner): approve or edit these lines.
export const MASCOT_MESSAGES = {
  hero: [
    { text: "Hi! I'm the Stoodant ant. I'll pop by now and then with a tip." },
    { text: "Every child learns at their own pace. That's where we start." },
  ],
  problem: [
    { text: "One teacher, forty students. Small batches mean every question gets answered." },
    { text: "Not every student moves at the same speed, and that's okay." },
  ],
  gap: [{ text: "Class 4 to 10 is where strong basics are built. That's our whole focus." }],
  process: [{ text: "It all starts with a free demo, so you can see if it fits.", link: { label: "Book a free demo", href: "#demo" } }],
  ahead: [
    { text: "Tip: peek at tomorrow's chapter for 10 minutes tonight." },
    { text: "When school catches up, it's revision, not panic." },
  ],
  batches: [
    { text: "1:1 for full attention, 1:20 for the best value. Pick what suits you." },
    { text: "Not sure which batch? Try a free demo first.", link: { label: "Book a free demo", href: "#demo" } },
  ],
  why: [{ text: "Tuition built around the learner, not the other way round." }],
  subjects: [
    { text: "Maths is everywhere, even in a pizza slice." },
    { text: "Explain a topic to someone else. It's the best test of understanding." },
  ],
  teachers: [{ text: "The right teacher changes everything. Meet one in your free demo.", link: { label: "Book a free demo", href: "#demo" } }],
  progress: [{ text: "Parents see the progress, not just the marks." }],
  testimonials: [{ text: "Every family's story starts with one class." }],
  faq: [{ text: "Got a question that isn't here? Tap the WhatsApp button and ask us." }],
  general: [
    { text: "Stuck on a doubt? Ask it. Every question is a good one." },
    { text: "A little revision every day beats one big night." },
    { text: "Short breaks help focus. Stretch, sip water, back to it." },
    { text: "Mistakes are just learning showing up. Keep going!" },
    { text: "Ahead of school, not behind it. That's the Stoodant way." },
    { text: "Your class. Your pace. Your tutor." },
    { text: "Small batches, from 1:1 to 1:20.", link: { label: "See batches", href: "#batches" } },
    { text: "Try a free demo class. No pressure, just learning.", link: { label: "Book a free demo", href: "#demo" } },
  ],
} as const;
