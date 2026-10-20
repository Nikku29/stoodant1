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
    // Its lines (what it says when tapped, per section) live in mascotConfig.ts, which loads only with the ant.
    roamerLabel: "Stoodant ant. Tap for a tip",
  },
  contact: { phone: "+91 83060 18141", whatsapp: "918306018141", email: "info@stoodant.com" },
  // Official profiles: shown in the footer and listed in the structured data so search engines link them to the site.
  social: [{ label: "Instagram", href: "https://www.instagram.com/stoodant_live" }],
  // Co-founders for the structured data. id matches a teacher slide id where the founder also teaches.
  founders: [
    { id: "jitesh-sain", name: "Jitesh Sain", jobTitle: "Co-founder", linkedin: "https://www.linkedin.com/in/jitesh-s-4a195a302" },
    { id: "nikhil-sharma", name: "Nikhil Sharma", jobTitle: "Co-founder and CTO", linkedin: "https://www.linkedin.com/in/nikhil-sharma-21a184265" },
  ],

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
    login: "Log in",
    loginMenu: "Parent & teacher log-in",
    menuOpen: "Open menu",
    menuClose: "Close menu",
  },
  // One short line shown under the logo on the loading screen.
  splash: { quote: "Every child learns at their own pace." },
  // Team photo shown full width directly under the header. Files live in public/team/ at each width below.
  teamBanner: {
    alt: "The Stoodant team smiling in black Stoodant polos on a yellow background, under a Meet the Team label, with the tagline Your Class. Your Pace. Your Tutor.",
    src: "/team/team-banner",
    widths: [640, 960, 1280],
    width: 1280,
    height: 720,
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
    labels: ["Trained", "Vetted", "Student-friendly", "Clear explainers"],
    teaches: "Teaches",
    ringLabel: "Our teachers",
    pausedLabel: "Paused · tap to resume",
    // Photos live in public/teachers/<photo>-360.webp and <photo>-720.webp (portrait, 4:5).
    // The ring needs at least 6 slides; if fewer are supplied they are repeated visually (repeats are aria-hidden).
    slides: [
      { id: "jitesh-sain", name: "Jitesh Sain", role: "Co-founder", highlights: ["Medico", "5+ years teaching", "Students' favourite"], quote: "I don't want a child's potential to be limited by their circumstances. I want every student to discover what they're truly capable of.", photo: "jitesh-sain" },
      { id: "dhanya-nalina", name: "Dr. Dhanya Nalina", subject: "Science", highlights: ["MBBS '21", "4+ years teaching", "99% in Class 10", "State topper"], photo: "dhanya-nalina" },
      { id: "akash-meena", name: "Akash Meena", subject: "Social Science", highlights: ["UPSC Prelims cleared", "Class 10 & 12 topper"], photo: "akash-meena" },
      { id: "umasree-gummala", name: "Umasree Gummala", subject: "Science", highlights: ["Medico", "Best explainer"], photo: "umasree-gummala" },
      { id: "ansh-sharma", name: "Ansh Sharma", subject: "Maths", highlights: ["3+ years teaching", "Top scorer in Maths"], photo: "ansh-sharma" },
      { id: "ankit-choudhary", name: "Ankit Choudhary", subject: "Maths", highlights: ["4+ years teaching", "Top scorer in Maths"], photo: "ankit-choudhary" },
      { id: "mahi-agarwal", name: "Mahi Agarwal", subject: "Maths", highlights: ["100/100 in Maths", "CAT qualified"], photo: "mahi-agarwal" },
      { id: "sanjay-jakhar", name: "Dr. Sanjay Jakhar", subject: "Science", highlights: ["MBBS '19", "5+ years teaching", "Class 10 & 12 top scorer"], photo: "sanjay-jakhar" },
      { id: "manjeet-shekhawat", name: "Manjeet Shekhawat", subject: "Science", highlights: ["Medico", "Best explainer"], photo: "manjeet-shekhawat" },
      { id: "jaanya-arora", name: "Jaanya Arora", subject: "Social Science", highlights: ["Psychology undergraduate", "Young talent"], photo: "jaanya-arora" },
      { id: "nikita-sharma", name: "Nikita Sharma", subject: "Social Science", highlights: ["4+ years teaching", "Best explainer"], photo: "nikita-sharma" },
    ] as { id: string; name: string; role?: string; subject?: string; highlights: string[]; quote?: string; photo: string | null }[],
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
    // Answers are written to be quoted on their own by search engines and AI assistants: each names Stoodant and states one fact.
    // {prices}, {subjects} and {phone} are filled in from the batches, subjects and contact above (see src/lib/faq.ts).
    items: [
      { q: "What is Stoodant?", a: "Stoodant is an online tuition service for Class 4 to 10 students in CBSE and ICSE schools. Classes are taught live by a real teacher in small batches, from 1:1 to 1:20, and every family starts with a free demo class." },
      { q: "How do batches work?", a: "Choose from 1:1, 1:5, 1:10, or 1:20 based on the level of attention your child needs. Smaller batches give more personal time with the teacher; larger batches cost less." },
      { q: "How much does Stoodant tuition cost?", a: "Fees are per student, per month, and depend on the batch size: {prices}. Taxes, if any, are extra. Every batch starts with a free demo." },
      { q: "Which boards and classes do you cover?", a: "Stoodant is designed for Class 4 to 10 students studying in CBSE and ICSE schools." },
      { q: "Which subjects do you teach?", a: "Stoodant teaches {subjects} for Class 4 to 10, following the CBSE and ICSE syllabus your child's school uses." },
      { q: "Is it online or offline?", a: "Stoodant classes are online and live, on Zoom or Google Meet. Your child learns from home with a real teacher, with time to ask questions in every class." },
      { q: "Who teaches at Stoodant?", a: "Stoodant was co-founded by Jitesh Sain and Nikhil Sharma. The teaching team includes doctors and medical students, a CAT qualifier and a UPSC Prelims qualifier, many with 3 to 5 or more years of teaching. You meet your child's teacher in the free demo." },
      { q: "Is there a free demo?", a: "Yes. Every batch starts with a free demo class, so your family can meet the teacher and understand the teaching approach before deciding." },
      { q: "How do I book a free demo?", a: "Fill in the short form on this page, or message Stoodant on WhatsApp at {phone}. The team will call you to fix a time that suits your child." },
      { q: "Can we switch batches later?", a: "Please speak with the Stoodant team about availability and the right fit before switching." },
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
  footer: {
    // One plain sentence about Stoodant, shown under the footer logo (helps search engines describe the brand).
    about: "Stoodant offers live online tuition for Class 4 to 10, CBSE and ICSE, in small batches from 1:1 to 1:20.",
    quickLinks: "Quick links",
    // Linked from the footer; the pages' text lives in pagesConfig.ts so it stays out of the landing page.
    pages: [
      { label: "About Stoodant", href: "/about" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Refund policy", href: "/refund-policy" },
    ], login: "Parent & teacher log-in", contact: "Contact", rights: "All rights reserved." },
  whatsapp: { label: "Chat on WhatsApp", message: "Hi Stoodant, I'd like to book a demo class." },
} as const;
