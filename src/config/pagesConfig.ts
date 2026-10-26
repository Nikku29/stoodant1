// Text for the About, Privacy, Terms and Refund pages. Kept apart from siteConfig.ts on purpose:
// siteConfig ships with the landing page, and these long texts should not add weight to it.
// Facts shared with the landing page (contact, batches, teachers, founders) come from siteConfig.
// TODO(owner): add the registered business name and postal address when available (see `legalEntity`),
// and have a lawyer review the Privacy, Terms and Refund text before relying on it.

export type InfoSection = { heading: string; paragraphs?: readonly string[]; list?: readonly string[] };
export type InfoPage = {
  heading: string;
  intro: string;
  sections: readonly InfoSection[];
};

export const PAGES_CONFIG = {
  // Bump when the Privacy, Terms or Refund text changes. Shown on those pages as "Last updated".
  lastUpdated: "2026-10-20",
  lastUpdatedLabel: "Last updated",
  // Shown in Privacy and Terms as the party responsible. Replace with the registered name and address.
  legalEntity: "Stoodant",
  backHome: "Back to Stoodant",
  contactHeading: "Contact us",
  contactLead: "Questions about anything on this page? We're happy to help.",

  about: {
    heading: "About Stoodant",
    intro: "Stoodant is an online tuition service for Class 4 to 10 students in CBSE and ICSE schools. Classes are taught live by a real teacher in small batches, from 1:1 to 1:20, and every family starts with a free demo class.",
    sections: [
      {
        heading: "Why we started",
        paragraphs: [
          "Class 4 to 10 is where a child's basics are built. Big coaching centres focus on senior students and competitive exams, and younger students often end up in crowded batches that move at one speed.",
          "We started Stoodant to give this stage the attention it deserves: small batches, teachers who explain clearly, and a pace that fits each child.",
        ],
      },
      {
        heading: "About the name",
        paragraphs: [
          "Stoodant is spelled S-T-O-O-D-A-N-T. It's a play on \"student\", because everything we do starts with the student, and it's our brand name, not a typo. If a search engine changes it to \"student\", choose \"search instead for stoodant\" or go straight to stoodant.com.",
        ],
      },
    ],
    foundersHeading: "Founders",
    // Founder details for founders who aren't in the teacher list (teachers' highlights and quotes come from siteConfig).
    founderNotes: {
      "nikhil-sharma": {
        highlights: ["Leads technology", "Built the Stoodant website, parent dashboard and teacher tools"],
        quote: "Parents shouldn't have to guess how their child is doing. I build the tools that keep families, teachers and students on the same page.",
      },
    } as Record<string, { highlights: readonly string[]; quote: string } | undefined>,
    teachersHeading: "Our teachers",
    teachersLead: "Every Stoodant teacher teaches the subject they know best. You meet your child's teacher in the free demo before you decide.",
    howHeading: "How classes work",
    howFacts: [
      "Live online classes on Zoom or Google Meet, so your child learns from home with a real teacher.",
      "Batch sizes of 1:1, 1:5, 1:10 or 1:20, chosen by you.",
      "We preview the next school chapter before school reaches it, then revise it when school does.",
    ],
  },

  privacy: {
    heading: "Privacy Policy",
    intro: "This policy explains what personal data Stoodant collects, why, how long we keep it and the choices you have. We follow India's Digital Personal Data Protection Act, 2023 (DPDP Act) and the Information Technology Act, 2000. We never sell personal data.",
    sections: [
      {
        heading: "Who we are",
        paragraphs: [
          "{legalEntity} (\"Stoodant\", \"we\") runs stoodant.com and decides how the personal data described here is used. Under the DPDP Act, we are the Data Fiduciary for this data.",
        ],
      },
      {
        heading: "What we collect",
        list: [
          "Demo requests: the parent's name, mobile number, the child's class and board, and your consent to be contacted.",
          "Accounts: the mobile number parents and teachers use to log in, and the email address of Stoodant team members.",
          "Learning records for enrolled students: the student's name, class, batch, attendance, test marks, teacher notes and the study material shared with the batch.",
          "Messages you send us by phone, WhatsApp or email.",
          "Basic technical data needed to run and protect the site, such as your browser type and anti-spam checks.",
        ],
      },
      {
        heading: "Why we use it",
        list: [
          "To call you about the free demo you asked for.",
          "To run classes, share progress and study material with parents, and let teachers record attendance and marks.",
          "To keep accounts secure, prevent spam and abuse, and fix problems with the site.",
          "To meet our legal obligations, such as keeping payment records.",
        ],
        paragraphs: ["We use personal data only for these purposes. We do not use it for advertising and we do not sell or rent it to anyone."],
      },
      {
        heading: "Children's data",
        paragraphs: [
          "Our students are children, so we handle their data with extra care. We collect a child's details only from their parent or guardian, with the parent's consent. We do not track children's behaviour across the internet, show them targeted advertising, or build profiles of them for any purpose other than their learning.",
          "A parent sees only their own child's progress. Teachers see only the students in their own batches.",
        ],
      },
      {
        heading: "How long we keep it",
        list: [
          "Demo requests that don't lead to enrolment: deleted after 3 months.",
          "Learning records and accounts: kept while your child studies with us, and deleted within 3 months after you leave, unless you ask us to delete them sooner.",
          "Payment records: kept for as long as Indian tax law requires.",
          "Backups: deleted data can remain in our secure backups for up to 8 weeks before it is overwritten.",
        ],
      },
      {
        heading: "Who we share it with",
        paragraphs: ["We share personal data only with service providers that help us run Stoodant, under contracts that require them to protect it and use it only for our purposes:"],
        list: [
          "Google Cloud and Firebase: database, file storage, log-in by SMS code, and spam protection.",
          "Vercel: hosting the website.",
          "Zoom and Google Meet: live classes.",
          "WhatsApp (Meta) and our email provider: when we message you or you message us.",
        ],
      },
      {
        heading: "How we protect it",
        paragraphs: [
          "Data is encrypted in transit and stored with access limited by role: parents, teachers and the Stoodant team each see only what they need. Log-in uses one-time SMS codes. If a personal data breach ever affects you, we will inform you and the Data Protection Board of India as the law requires.",
        ],
      },
      {
        heading: "Your rights",
        list: [
          "See a summary of the personal data we hold about you and how we use it.",
          "Correct or update your data.",
          "Ask us to delete your data, or withdraw your consent at any time. Withdrawing consent doesn't affect what we did before, but we may no longer be able to provide classes.",
          "Name another person to exercise these rights on your behalf if you are unable to.",
          "Raise a complaint with us, and if you are not satisfied, with the Data Protection Board of India.",
        ],
        paragraphs: ["To use any of these rights, email us at {email} or call {phone}. We will reply as soon as possible and within 30 days at most."],
      },
      {
        heading: "Cookies and browser storage",
        paragraphs: ["We don't use advertising cookies. The site stores small items in your browser to keep you logged in and remember simple display choices, and our spam protection may set its own cookie."],
      },
      {
        heading: "Changes to this policy",
        paragraphs: ["If we change this policy, we will update the date at the top of this page. For important changes, we will also tell enrolled families directly."],
      },
    ],
  },

  terms: {
    heading: "Terms of Service",
    intro: "These terms apply when you book a free demo or enrol your child in Stoodant's online classes. By enrolling, you agree to them. If anything is unclear, please ask us before you pay.",
    sections: [
      {
        heading: "Our service",
        paragraphs: [
          "Stoodant provides live online tuition for Class 4 to 10 students in CBSE and ICSE schools, taught on Zoom or Google Meet in batches of 1:1, 1:5, 1:10 or 1:20. The free demo class has no charge and no obligation.",
          "We teach to help your child understand and keep up with school. We cannot promise specific marks or results, because they depend on many things outside our classes.",
        ],
      },
      {
        heading: "Enrolment and fees",
        list: [
          "Fees are per student, per month, and paid in advance before the month's classes start. Taxes, if any, are extra.",
          "Fees for each batch size are shown on our website. We will tell you before any change to your fee, and a change applies only from the next month.",
          "The parent or guardian who enrols the child is responsible for payment and for keeping their contact details up to date.",
          "Refunds follow our Refund and Cancellation Policy.",
        ],
      },
      {
        heading: "Classes",
        list: [
          "Class timings are agreed when you enrol. If a teacher has to cancel a class, we will reschedule it.",
          "Changing batch size or timing depends on availability. Please speak with the Stoodant team first.",
          "Parents and students need a working internet connection and a device that can run Zoom or Google Meet.",
        ],
      },
      {
        heading: "Safe and respectful classes",
        list: [
          "Class links are private. Please don't share them with anyone outside the batch.",
          "Students, parents and teachers treat each other with respect. We may remove anyone from a class who disrupts it or behaves inappropriately, after speaking with the parent.",
          "Please don't record classes or share screenshots of other students without their parents' permission.",
        ],
      },
      {
        heading: "Study material",
        paragraphs: ["Notes, worksheets and recordings we share are for your child's personal study. Please don't copy, sell or publish them."],
      },
      {
        heading: "Your data",
        paragraphs: ["How we handle personal data is explained in our Privacy Policy."],
      },
      {
        heading: "Liability",
        paragraphs: ["We take care to provide classes as described. Our total liability for any claim relating to our service is limited to the fees you paid for the month in which the issue arose, to the extent the law allows. Nothing in these terms limits your rights under the Consumer Protection Act, 2019."],
      },
      {
        heading: "Changes and governing law",
        paragraphs: [
          "We may update these terms and will change the date on this page when we do. For important changes, we will tell enrolled families before they apply.",
          "These terms are governed by the laws of India, and disputes are subject to the jurisdiction of Indian courts. We will always try to resolve a concern with you directly first.",
        ],
      },
    ],
  },

  refund: {
    heading: "Refund and Cancellation Policy",
    intro: "Every family starts with a free demo class, so you can meet the teacher and see the teaching approach before paying anything.",
    sections: [
      {
        heading: "Before classes start",
        paragraphs: ["If you cancel after paying but before your child's first class of the paid month, we refund the full fee to the original payment method within 7 working days."],
      },
      {
        heading: "After classes start",
        paragraphs: ["Once classes for the paid month have started, the fee for that month is not refundable, including for classes the student misses. You can stop at any time by telling us before the next month's payment, and you won't be charged again."],
      },
      {
        heading: "If we cancel",
        paragraphs: ["If Stoodant cannot continue your child's batch and we cannot offer a suitable alternative, we refund the fee for the classes not held."],
      },
      {
        heading: "How to ask",
        paragraphs: ["Message us on WhatsApp or call {phone}, or email {email}, with the parent's name and the child's batch."],
      },
    ],
  },
} as const;
