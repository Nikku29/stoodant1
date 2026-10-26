// Stoodant blog: articles for parents, written to answer the questions they search for.
// Loaded only by the /blog pages (and by the build for the sitemap and llms.txt), never by the landing page.
// Relative imports only: vite.config.ts loads this module through src/seo/files.ts, and path aliases don't apply there.
// To add a post: add an entry at the top of BLOG_POSTS. The page, sitemap, llms.txt and structured data follow.
import type { InfoSection } from "../config/pagesConfig";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD) shown on the post and in the structured data. */
  date: string;
  heading: string;
  intro: string;
  sections: readonly InfoSection[];
};

export const BLOG = {
  path: "/blog",
  title: "Stoodant Blog | Study tips and tuition advice for parents",
  description: "Plain advice for parents of Class 4 to 10 students: choosing tuition, CBSE and ICSE, batch sizes and helping your child stay ahead of school.",
  heading: "Stoodant Blog",
  intro: "Practical advice for parents of Class 4 to 10 students, from the Stoodant team.",
  author: "Stoodant team",
  publishedLabel: "Published",
  readMore: "Read article",
  nextHeading: "Keep reading",
  ctaHeading: "Try a free demo class",
  ctaCopy: "See how your child learns with a real Stoodant teacher, live online, before you pay anything.",
  ctaButton: "Book a free demo",
  allPosts: "All articles",
} as const;

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: "what-is-stoodant",
    title: "What is Stoodant? Online tuition for Class 4 to 10 (not a typo for student)",
    description: "Stoodant is a live online tuition service for Class 4 to 10 CBSE and ICSE students in India, with batches from 1:1 to 1:20 and a free demo class.",
    date: "2026-10-26",
    heading: "What is Stoodant?",
    intro: "Stoodant (spelled S-T-O-O-D-A-N-T) is an Indian online tuition service for Class 4 to 10 students in CBSE and ICSE schools. It isn't a misspelling of \"student\": it's our name, and this page explains what we do and where the name comes from.",
    sections: [
      {
        heading: "Stoodant in one paragraph",
        paragraphs: [
          "Stoodant teaches Maths, Science, English, Social Science, Hindi and Computer to students from Class 4 to Class 10, live and online. Every class has a real teacher on Zoom or Google Meet. Parents choose the batch size, from one-to-one up to twenty students, and every family starts with a free demo class before paying anything. The website is stoodant.com.",
        ],
      },
      {
        heading: "Why the name Stoodant?",
        paragraphs: [
          "The name is a play on \"student\", because everything we do starts with the student: their class, their pace and their tutor. We spell it with a double O, and you'll see those two O's as a pair of eyes in our logo.",
          "If you searched for Stoodant and your search engine showed results for \"student\", choose \"search instead for stoodant\", or go straight to stoodant.com.",
        ],
      },
      {
        heading: "Who runs Stoodant",
        paragraphs: [
          "Stoodant was co-founded by Jitesh Sain and Nikhil Sharma. The teaching team includes doctors and medical students, a CAT qualifier and a UPSC Prelims qualifier, many with years of teaching experience. You meet your child's teacher in the free demo.",
        ],
      },
      {
        heading: "How it works",
        list: [
          "Book a free demo class on stoodant.com or on WhatsApp.",
          "Your child attends a live demo with a Stoodant teacher.",
          "Pick a batch size (1:1, 1:5, 1:10 or 1:20) that fits your child and your budget.",
          "Classes run live online. Teachers preview the next school chapter, then revise it when school reaches it.",
        ],
      },
    ],
  },
  {
    slug: "how-to-choose-online-tuition",
    title: "How to choose online tuition for Class 4 to 10: a checklist for parents",
    description: "Seven questions to ask before you pay for online tuition: who teaches, batch size, live or recorded, board match, progress reports, trial class and refunds.",
    date: "2026-10-26",
    heading: "How to choose online tuition for Class 4 to 10",
    intro: "Online tuition can work very well for school students, but options vary a lot. Before you pay, these seven questions help you compare any tuition service, including ours.",
    sections: [
      {
        heading: "1. Is the class live, with a real teacher?",
        paragraphs: ["Recorded videos are useful for revision, but younger students learn best when a teacher can see their confusion and explain again. Ask whether every class is live, and whether your child can ask questions during it."],
      },
      {
        heading: "2. Who exactly will teach my child?",
        paragraphs: ["Ask for the teacher's name, subject and experience, and ask to meet them before you commit. A good service is happy to tell you, and lets your child attend a class with the actual teacher."],
      },
      {
        heading: "3. How many students are in the batch?",
        paragraphs: ["Batch size decides how much attention your child gets. One-to-one suits a child who needs a lot of support or has specific gaps. Small batches of around 5 to 10 give attention plus the energy of other students. Larger batches cost less but suit children who are already confident and self-driven."],
      },
      {
        heading: "4. Does it follow my child's board and school pace?",
        paragraphs: ["CBSE and ICSE cover similar subjects in different depth and order. Check that the tuition follows your child's board and class, and ideally that it moves slightly ahead of school, so lessons in school feel like revision rather than new material."],
      },
      {
        heading: "5. How will I know if it's working?",
        paragraphs: ["Ask how you'll hear about attendance, test marks and what was covered. Regular, specific updates are better than a vague \"doing well\"."],
      },
      {
        heading: "6. Is there a free trial class?",
        paragraphs: ["A free demo lets your child judge the teacher and the format. If your child comes out of the demo understanding something they didn't before, that's a good sign."],
      },
      {
        heading: "7. What happens if it doesn't work out?",
        paragraphs: ["Read the refund and cancellation policy before paying. Check whether fees are monthly or locked in for a long period, and what notice you need to give to stop."],
      },
      {
        heading: "A quick checklist",
        list: [
          "Live classes with a named, experienced teacher",
          "A batch size that fits your child",
          "Follows your board, ideally a little ahead of school",
          "Clear progress updates for parents",
          "A free demo before paying",
          "A clear, fair refund policy",
        ],
      },
    ],
  },
  {
    slug: "one-to-one-vs-small-batch-tuition",
    title: "1:1 or small batch tuition: which suits your child?",
    description: "How to decide between one-to-one tuition and small group batches for a Class 4 to 10 student, based on confidence, gaps, budget and learning style.",
    date: "2026-10-26",
    heading: "1:1 or small batch tuition: which suits your child?",
    intro: "Parents often assume one-to-one tuition is always best. It's the most personal option, but it isn't the right fit for every child. Here's how to decide.",
    sections: [
      {
        heading: "When one-to-one works best",
        list: [
          "Your child has gaps from earlier classes that need to be filled before they can keep up.",
          "Your child is shy and won't ask questions in front of others.",
          "Your child needs a schedule built around other commitments.",
          "Exams are close and you want every minute focused on your child's weak topics.",
        ],
      },
      {
        heading: "When a small batch works best",
        list: [
          "Your child is roughly at grade level and wants to get stronger and stay ahead.",
          "Your child enjoys some company and learns from other students' questions.",
          "You want regular, structured classes at a lower monthly fee.",
        ],
        paragraphs: ["In a batch of around 5 to 10, the teacher still knows every student by name and can check each one's work, while students hear different doubts and explanations they might not have thought of."],
      },
      {
        heading: "When a larger batch is enough",
        paragraphs: ["Confident, self-motivated students who mainly want a structured class and practice often do well in larger batches, which cost the least. If your child needs more help later, you can move to a smaller batch."],
      },
      {
        heading: "Try before you decide",
        paragraphs: ["The easiest way to choose is to watch your child in a real class. At Stoodant, every family starts with a free demo, and you can choose a batch of 1:1, 1:5, 1:10 or 1:20 after it."],
      },
    ],
  },
  {
    slug: "cbse-vs-icse-class-4-to-10",
    title: "CBSE vs ICSE for Class 4 to 10: what's really different",
    description: "A plain comparison of CBSE and ICSE for Class 4 to 10: who runs each board, textbooks, depth of syllabus, English, assessments, and what it means for tuition.",
    date: "2026-10-26",
    heading: "CBSE vs ICSE for Class 4 to 10",
    intro: "CBSE and ICSE are two of India's most common school boards. Both prepare students well, but they teach in different ways. Here's what parents of Class 4 to 10 students should know.",
    sections: [
      {
        heading: "Who runs each board",
        paragraphs: ["CBSE is the Central Board of Secondary Education, a national board under the Government of India. ICSE is the Class 10 examination of the Council for the Indian School Certificate Examinations (CISCE), a private, non-government board; its Class 12 exam is called ISC."],
      },
      {
        heading: "Textbooks and syllabus",
        paragraphs: ["CBSE schools mainly follow NCERT textbooks, with a syllabus focused on core concepts. ICSE schools use books from various publishers, and the syllabus is generally more detailed, with more topics covered in each subject."],
      },
      {
        heading: "English and languages",
        paragraphs: ["ICSE is known for its strong focus on English, with separate papers for English language and literature. CBSE also teaches English well, but with less literature in the lower classes."],
      },
      {
        heading: "Assessment",
        paragraphs: ["Both boards hold Class 10 board exams and include school-based internal assessment. ICSE gives weight to projects and practical work across many subjects, while CBSE exams focus more on application of NCERT concepts."],
      },
      {
        heading: "What it means for tuition",
        list: [
          "A CBSE student benefits from strong concept building and plenty of NCERT-based practice.",
          "An ICSE student needs help with the wider syllabus and more writing, especially in English and the sciences.",
          "Either way, the tutor should know your child's board and follow its order of chapters.",
        ],
        paragraphs: ["Stoodant teaches both CBSE and ICSE students from Class 4 to 10, and plans each batch around its board."],
      },
    ],
  },
  {
    slug: "study-ahead-of-school",
    title: "How to help your child stay one chapter ahead of school",
    description: "A simple weekly routine for Class 4 to 10 students to preview the next chapter, so school lessons feel like revision and confidence grows.",
    date: "2026-10-26",
    heading: "How to help your child stay one chapter ahead of school",
    intro: "Children who have seen a topic before school teaches it tend to listen better, ask better questions and feel more confident. Staying ahead doesn't need long hours, just a simple routine.",
    sections: [
      {
        heading: "Why previewing works",
        paragraphs: ["When a child meets a new idea for the first time in a busy classroom, much of the lesson goes into just following along. If they have already seen the idea once, the school lesson becomes a second explanation, and the gaps close on their own."],
      },
      {
        heading: "A simple weekly routine",
        list: [
          "Sunday: check the school timetable or ask your child which chapters come next.",
          "Twice a week, 20 minutes: read the next chapter's opening pages and look at the examples together.",
          "Once a week: try three or four easy questions from the new chapter, without worrying about mistakes.",
          "After school covers it: revise with the end-of-chapter exercises.",
        ],
      },
      {
        heading: "Keep it light",
        paragraphs: ["The goal of previewing is familiarity, not mastery. Praise effort, keep sessions short, and stop before your child gets tired. Confidence matters more than finishing the chapter early."],
      },
      {
        heading: "When to get help",
        paragraphs: ["If previewing at home turns into arguments, or your child is already behind, a teacher can do the previewing for them. Stoodant classes preview the next school chapter before school reaches it, then revise it when school does."],
      },
    ],
  },
];

export function blogPostPath(slug: string) {
  return `${BLOG.path}/${slug}`;
}

export function findBlogPost(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
