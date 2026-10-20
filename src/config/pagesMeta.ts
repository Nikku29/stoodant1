// Address, title and description of the About, Privacy, Terms and Refund pages. Kept tiny and apart from
// pagesConfig.ts because route heads load with every page, including the landing page; the long page text
// in pagesConfig.ts loads only with its own page.
export const PAGES_META = {
  about: { path: "/about", title: "About Stoodant | Online Tuition for Class 4-10", description: "Who runs Stoodant, who teaches, and how our live online classes for Class 4 to 10 (CBSE & ICSE) work." },
  privacy: { path: "/privacy", title: "Privacy Policy | Stoodant", description: "How Stoodant collects, uses, protects and deletes personal data, in line with India's Digital Personal Data Protection Act, 2023." },
  terms: { path: "/terms", title: "Terms of Service | Stoodant", description: "The terms for Stoodant's free demo class and paid online tuition for Class 4 to 10." },
  refund: { path: "/refund-policy", title: "Refund and Cancellation Policy | Stoodant", description: "When Stoodant fees can be refunded: in full before classes start, not after classes for the month have started." },
} as const;

export type PageMeta = (typeof PAGES_META)[keyof typeof PAGES_META];
