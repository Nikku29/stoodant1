export const SITE_CONFIG = {
  brand: { name: "Stoodant", tagline: "Your Class. Your Pace. Your Tutor." },
  // Live address; used for absolute share links (OG image, canonical URL).
  siteUrl: "https://stoodant.com",

  // ---- MASCOT (the ant) ----
  // The ant has no name for now and none is shown anywhere. TODO(owner): revisit a name later if wanted.
  // Its caption under the Final CTA ant is the brand tagline (brand.tagline above).
  mascot: {
    name: "",
    // The roaming ant pops up now and then, walks a little, and says something when tapped.
    // It first picks a line for the section on screen, then general ones (shuffled, no repeats until all are used).
    // Keep lines warm and short; no factual claims about ants. TODO(owner): approve or edit these lines.
    roamerLabel: "Stoodant ant. Tap for a tip",
    messages: {
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
    },
  },
  contact: { phone: "+91 XXXXX XXXXX", whatsapp: "91XXXXXXXXXX", email: "hello@stoodant.com" },

  // ---- OFFER / DISCOUNT ----
  // Set discountPercent above 0 and add an offerLabel to switch the offer on.
  // Set discountPercent to 0 to switch it off; all offer UI then disappears.
  offer: {
    discountPercent: 0,
    offerLabel: "",
    offerEndsOn: null as string | null,
  },

  // ---- BATCHES (base monthly prices in INR) ----
  batches: [
    { id: "1-1", ratio: "1:1", name: "Private", basePrice: 7999, students: 1, popular: false },
    { id: "1-5", ratio: "1:5", name: "Small Group", basePrice: 5999, students: 5, popular: true },
    { id: "1-10", ratio: "1:10", name: "Classroom Plus", basePrice: 4999, students: 10, popular: false },
    { id: "1-20", ratio: "1:20", name: "Smart Batch", basePrice: 2999, students: 20, popular: false },
  ],

  navigation: {
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Batches", href: "#batches" },
      { label: "Why Stoodant", href: "#why-stoodant" },
      { label: "Subjects", href: "#subjects" },
      { label: "FAQ", href: "#faq" },
    ],
    cta: "Book a Free Demo",
    menuOpen: "Open menu",
    menuClose: "Close menu",
  },
  hero: {
    headline: ["Learning that moves", "at your pace."],
    highlight: "your pace", // amber highlighter swoosh behind this phrase
    subhead: "Personalised tuition for Class 4 to 10. CBSE & ICSE. Small batches, real attention.",
    primaryCta: "Book a Free Demo",
    secondaryCta: "See Batches",
    trust: "Class 4-10 · CBSE & ICSE · 1:1 to 1:20 batches",
    subjects: ["Maths", "Science", "English", "Social Science"],
  },
  problem: {
    kicker: "The challenge",
    title: "School alone isn't always enough.",
    note: "Teachers do vital work. But one classroom cannot always move at every child's pace.",
    beats: [
      { title: "One teacher, forty students.", type: "dots" },
      { title: "One speed for everyone.", type: "pace" },
      { title: "Old methods, new world.", type: "device" },
      { title: "Nobody tells you what's next.", type: "path" },
    ],
    // "Old methods, new world" slide: how the student feels before and after.
    shiftMood: { before: "Bored", after: "Happy!" },
  },
  gap: {
    kicker: "The missing middle",
    headline: "Big coaching centres aren't built for Class 4-10. We are.",
    paragraphs: [
      "Big institutes focus on competitive exam preparation for senior students. Younger students are often left in crowded batches.",
      "Stoodant gives this stage the attention it deserves — before the pressure begins.",
    ],
    classes: ["4", "5", "6", "7", "8", "9", "10"],
    focus: "Big coaching focus →",
    beyond: "11–12 & beyond",
  },
  process: {
    kicker: "How it works",
    headline: "A clearer path, from day one.",
    steps: [
      { number: "01", title: "Free demo & assessment", copy: "Meet the teacher and understand your child's current learning needs." },
      { number: "02", title: "Pick your batch", copy: "Choose the group size that suits your child and your budget." },
      { number: "03", title: "Learn at your pace", copy: "Build concepts clearly with room to ask, practise, and improve." },
      { number: "04", title: "Preview what's next", copy: "See upcoming school topics early and arrive prepared." },
    ],
  },
  ahead: {
    kicker: "Stay ahead",
    headline: "Don't just revise. Get ahead.",
    explanation: "Students learn what's coming next in school and how to prepare for it.",
    steps: ["Today", "Next", "Future"],
    // TODO: Replace these generic descriptions with verified, real topic examples when available.
    stepDescriptions: ["The chapter you're learning in school", "The next chapter, previewed", "The chapters ahead"],
    schoolPace: "School pace",
    stoodantPace: "With Stoodant",
    aheadLabel: "Ahead",
    slides: [
      { title: "Stay one step ahead.", caption: "We preview the next chapter before school reaches it." },
      { title: "Then we make it stick.", caption: "Previewed first. Revised when school arrives." },
      { title: "Learning that connects to real life.", caption: "Not just from books. From the world around them." },
    ],
    reviseLabel: "Revise",
    // TODO: Owner — edit these concept / real-life pairs. drawing must be one of: pizza, car, tag, room.
    realLife: [
      { concept: "Fractions", drawing: "pizza" },
      { concept: "Speed = distance / time", drawing: "car" },
      { concept: "Percentages", drawing: "tag" },
      { concept: "Area", drawing: "room" },
    ],
  },
  pricing: {
    kicker: "Batches & pricing",
    heading: "Pick the batch that fits your child.",
    subtext: "Pricing varies by class and batch size. Every batch starts with a free demo.",
    popular: "Most Popular",
    perMonth: "/ month",
    teacher: "Teacher",
    students: "Students",
    button: "Book Free Demo",
    save: "Save",
    note: "Prices are per student, per month. Taxes (if any) extra.", // TODO: Owner to confirm.
    details: {
      "1-1": { bestFor: "Best for students who need full personal attention.", benefits: ["Fully custom pace", "Flexible timings", "Direct teacher focus"] },
      "1-5": { bestFor: "Best for focused group learning.", benefits: ["Personal attention", "Peer learning", "Balanced price"] },
      "1-10": { bestFor: "Best for confident learners who like a classroom feel.", benefits: ["Interactive sessions", "Regular doubt time", "Affordable"] },
      "1-20": { bestFor: "Best for steady learners on a budget.", benefits: ["Structured lessons", "Regular practice", "Most affordable"] },
    },
  },
  comparison: {
    kicker: "Why Stoodant",
    headline: "Tuition, built around the learner.",
    columns: ["Typical tuition", "Stoodant"],
    rows: [
      ["Crowded batches", "Choose your batch size"],
      ["One pace", "Your pace"],
      ["Rote learning", "Concept clarity"],
      ["No preview", "Know what's next"],
      // Hidden until parent logins and progress reports exist (owner, 2026-10-17). Uncomment to show it again.
      // ["Parents in the dark", "Parents see progress"],
    ],
  },
  subjects: {
    kicker: "Subjects & boards",
    headline: "The school essentials, covered.",
    rowOne: ["Maths", "Science", "English", "Social Science", "Hindi", "Computer"],
    rowTwo: ["CBSE", "ICSE", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"],
  },
  teachers: {
    kicker: "Teachers",
    headline: "The right teacher changes everything.",
    labels: ["Trained", "Vetted", "Student-friendly", "Clear explainers"], // TODO: Replace with real teacher profiles.
    placeholder: "Teacher profile coming soon",
    ringLabel: "Our teachers",
    profileTag: "Profile coming soon",
    pausedLabel: "Paused · tap to resume",
    // TODO: Owner — replace with real teacher photo (photo URL), name and details.
    // The ring needs at least 6 slides; if fewer are supplied they are repeated visually (repeats are aria-hidden).
    slides: [
      { id: "t1", label: "Teacher 01", trait: "Trained", description: "Profile details coming soon.", photo: null }, // TODO
      { id: "t2", label: "Teacher 02", trait: "Vetted", description: "Profile details coming soon.", photo: null }, // TODO
      { id: "t3", label: "Teacher 03", trait: "Student-friendly", description: "Profile details coming soon.", photo: null }, // TODO
      { id: "t4", label: "Teacher 04", trait: "Clear explainers", description: "Profile details coming soon.", photo: null }, // TODO
      { id: "t5", label: "Teacher 05", trait: "Trained", description: "Profile details coming soon.", photo: null }, // TODO
      { id: "t6", label: "Teacher 06", trait: "Vetted", description: "Profile details coming soon.", photo: null }, // TODO
    ] as { id: string; label: string; trait: string; description: string; photo: string | null }[],
  },
  progress: {
    kicker: "Parent progress",
    headline: "See the learning, not just the marks.",
    sample: "Sample view",
    rings: [
      { label: "Attendance", value: 92 },
      { label: "Practice", value: 78 },
      { label: "Concepts", value: 84 },
    ],
    week: "This week",
    days: ["M", "T", "W", "T", "F", "S"],
    bars: [52, 76, 64, 88, 72, 94],
    reportTitle: "Weekly report",
    reportCopy: "A simple view of topics covered, practice, and what comes next.",
  },
  testimonials: {
    kicker: "Parent voices",
    headline: "Real stories, coming soon.",
    cards: ["Parent review coming soon", "Parent review coming soon", "Parent review coming soon"], // TODO: Replace only with verified parent reviews.
  },
  faq: {
    kicker: "FAQ",
    headline: "A few things you may want to know.",
    items: [
      { q: "How do batches work?", a: "Choose from 1:1, 1:5, 1:10, or 1:20 based on the level of attention your child needs." },
      { q: "Which boards and classes do you cover?", a: "Stoodant is designed for Class 4 to 10 students studying in CBSE and ICSE schools." },
      { q: "Is there a free demo?", a: "Yes. Every batch starts with a free demo so your family can understand the teaching approach." },
      { q: "Can we switch batches later?", a: "Please speak with the Stoodant team about availability and the right fit before switching." },
      { q: "Is it online or offline?", a: "The delivery format is being finalised. Please contact the team for the latest availability." },
      { q: "How do I pay?", a: "Payment details will be shared by the Stoodant team after your demo." },
    ], // TODO: Owner to confirm all answers.
  },
  form: {
    kicker: "Free demo",
    headline: "Ready to learn your way?",
    highlight: "your way", // amber highlighter swoosh behind this phrase
    // Parent's name, not the student's: no child's personal data at the lead stage (owner, 2026-10-17).
    parentName: "Parent name",
    parentPlaceholder: "Enter your name",
    classLabel: "Class",
    classPlaceholder: "Select class",
    boardLabel: "Board",
    boardPlaceholder: "Select board",
    phoneLabel: "Parent phone",
    phonePlaceholder: "10-digit mobile number",
    classes: ["4", "5", "6", "7", "8", "9", "10"],
    boards: ["CBSE", "ICSE"],
    submit: "Book my free demo",
    submitting: "Booking your demo…",
    // TODO: Owner — confirm this notice with a lawyer and link the Privacy page once it exists.
    // Bump noticeVersion (YYYY-MM-DD) whenever the wording changes; each lead records the version it agreed to.
    consent: "I agree that Stoodant may use these details to contact me about a free demo. We keep them for 3 months and never sell them.",
    noticeVersion: "2026-10-17",
    success: "Thank you! We'll call you shortly.",
    errors: { name: "Please enter your name.", className: "Please select a class.", board: "Please select a board.", phone: "Enter a valid 10-digit Indian mobile number.", consent: "Please tick the box so we can contact you.", rateLimited: "You've sent a few requests already. We'll be in touch soon, or message us on WhatsApp.", network: "We couldn't send your request. Please try again, or message us on WhatsApp." },
  },
  footer: { quickLinks: "Quick links", contact: "Contact", rights: "All rights reserved." },
  whatsapp: { label: "Chat on WhatsApp", message: "Hi Stoodant, I'd like to book a demo class." },
} as const;
