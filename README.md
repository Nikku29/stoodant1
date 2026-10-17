# Stoodant

Build a production-quality, single-page, heavily animated landing page for "STOODANT", an Indian tutoring startup. Follow every instruction literally. Do not add sections, features, stock photos, fake statistics, fake reviews, or colours that are not listed here. If something is unspecified, use the simplest option and leave a clear TODO comment.

## TECH STACK (fixed)
- React + TypeScript + Vite + Tailwind CSS.
- Animation: Framer Motion for component/scroll reveals, GSAP + ScrollTrigger for pinned storytelling and SVG path drawing, Lenis for smooth scrolling.
- Icons: lucide-react. No other UI/animation libraries.
- Fonts (Google Fonts): "Sora" 600/700/800 for headings, "Inter" 400/500/600 for body.
- All editable content lives in ONE file: src/config/siteConfig.ts (see CONFIG section). No hard-coded prices, copy, or contact details anywhere else.

## CONFIG FILE (src/config/siteConfig.ts), CRITICAL
Create this file exactly in this shape:

export const SITE_CONFIG = {
  brand: { name: "Stoodant", tagline: "Your Class. Your Pace. Your Tutor." },
  contact: { phone: "+91 XXXXX XXXXX", whatsapp: "91XXXXXXXXXX", email: "hello@stoodant.com" },

  // ---- OFFER / DISCOUNT ----
  // Set discountPercent to a number (e.g. 20) AND offerLabel to a string (e.g. "Diwali Offer") to switch the offer on.
  // Set discountPercent to 0 to switch the offer off. The site then shows normal prices with no offer UI at all.
  offer: {
    discountPercent: 0,        // e.g. 20 means 20% off
    offerLabel: "",            // e.g. "Diwali Offer", "Navratri Special", "New Session Offer"
    offerEndsOn: null as string | null, // optional, ISO date like "2026-11-15". If set and the date has passed, the offer auto-hides.
  },

  // ---- BATCHES (base monthly prices in INR) ----
  batches: [
    { id: "1-1",  ratio: "1:1",  name: "Private",        basePrice: 7999, students: 1,  popular: false },
    { id: "1-5",  ratio: "1:5",  name: "Small Group",    basePrice: 5999, students: 5,  popular: true  },
    { id: "1-10", ratio: "1:10", name: "Classroom Plus", basePrice: 4999, students: 10, popular: false },
    { id: "1-20", ratio: "1:20", name: "Smart Batch",    basePrice: 2999, students: 20, popular: false },
  ],
};

Also create a helper src/lib/pricing.ts with:
- isOfferActive(): true only if discountPercent > 0 AND offerLabel is a non-empty string AND (offerEndsOn is null OR today <= offerEndsOn).
- getPrice(basePrice): returns { original, final, saved }. final = Math.round(basePrice * (1 - discountPercent/100)) when the offer is active, otherwise final = basePrice. saved = original - final.
- formatINR(n): uses Intl.NumberFormat("en-IN") and the ₹ symbol, e.g. ₹7,999.

Worked example for verification: at 20% off, 7999 -> ₹6,399, 5999 -> ₹4,799, 4999 -> ₹3,999, 2999 -> ₹2,399.

### Offer display rules (apply wherever prices appear)
When isOfferActive() is true:
1. A pill badge near the top of the batch section and also in a slim top announcement bar above the navbar reads: "{offerLabel}: {discountPercent}% OFF" (e.g. "Diwali Offer: 20% OFF"). If offerEndsOn is set, append "· Ends {DD Mon}".
2. Each batch card shows the original price with a grey strikethrough, the new price in large bold black, and a small black chip "Save ₹{saved}".
3. The announcement bar is dismissible (X button) and remembers dismissal in sessionStorage.
When isOfferActive() is false: render NONE of the above. No empty bar, no empty badge, no strikethrough, no gaps in the layout.
The offer text must update everywhere automatically from the config. The label and percent must never be hard-coded in any component.
Add a short comment block above the offer object explaining how to switch it on and off.

## BRAND & LOGO
- Wordmark: the official STOODANT logo (brand-assets/stoodant-logo-original.jpeg): the two O's are amber eyes joined by a small glasses bridge. Recreate it as an inline SVG component <Logo /> (no image file). Tagline below it in 11px uppercase with 0.3em letter spacing.
- The ant (Stood + ANT) is the secondary motif: section dividers (dotted trail), final CTA graphic, form success, and the Problem / Stay Ahead slides. Do not use it anywhere else.

## COLOURS (strictly monochrome, no exceptions)
White #FFFFFF, off-white #F5F5F5, greys #E5E5E5 / #D4D4D4 / #A3A3A3 / #737373 / #404040, near-black #0A0A0A. No blue, green, red, gradients with colour, or coloured glows. Emphasis comes only from size, weight, contrast, and motion.

## LAYOUT & STYLE
- Max content width 1200px, 8px spacing grid, very large headlines (clamp(2.5rem, 7vw, 6.5rem) on hero), generous whitespace, 16-24px rounded corners, 1px grey borders, subtle noise/grain overlay at 4% opacity.
- Alternate section backgrounds: white, then near-black, then off-white, with smooth colour transitions as the user scrolls into them.
- All illustrations are custom inline SVG, black/grey line-art with 2px strokes. No stock photos, no emojis, no AI-generated images.
- Mobile-first. Test mentally at 375px, 768px, 1280px. Pinned/complex scroll effects become simple fade-ups below 768px.

## ANIMATION SPEC (be exact)
- Easing everywhere: cubic-bezier(0.22, 1, 0.36, 1). Reveal duration 0.8s. Stagger 0.08s. Translate distance 40px.
- LOADER (first visit only, max 2.2s): the logo letters jump in, the eyes pop and blink, sparks and tagline appear, then the splash lifts away to reveal the hero.
- HERO: headline reveals line by line using masked slide-up. Background has 6-8 slow-floating grey SVG shapes (books, pencil, ruler, lightbulb) drifting at different parallax speeds on scroll. Two CTAs with magnetic hover (button moves up to 8px toward the cursor).
- Every section heading reveals word by word. Every card lifts 6px with a shadow on hover. Buttons invert colours on hover.
- Sticky storytelling (GSAP ScrollTrigger pin) for sections 3 and 6. Roadmap in section 5 draws its SVG path with scrub linked to scroll.
- Counters count up once when they enter the viewport.
- A 2px black scroll-progress bar fixed at the top.
- Custom cursor on desktop only: a 12px black dot with a 36px ring that grows over links/buttons. Hidden on touch devices.
- Respect prefers-reduced-motion: disable pinning, parallax, and loader, and keep only simple fades.
- Performance: animate only transform and opacity. No layout-thrashing animations.

## SECTIONS (build in this exact order, with this exact copy)

0. ANNOUNCEMENT BAR: only visible when the offer is active (see rules above).

1. NAVBAR (sticky, blurs on scroll): <Logo />, links "How it works", "Batches", "Why Stoodant", "Subjects", "FAQ", button "Book a Free Demo". Mobile: hamburger with full-screen black overlay menu.

2. HERO
- Headline: "Learning that moves at your pace."
- Subhead: "Personalised tuition for Class 4 to 10. CBSE & ICSE. Small batches, real attention."
- Buttons: "Book a Free Demo" (solid black), "See Batches" (outline).
- Visual: a stack of 4 floating subject cards (Maths, Science, English, Social Science) that gently tilt with the mouse (desktop) and bob slowly (mobile).
- Under the buttons, a trust line: "Class 4-10 · CBSE & ICSE · 1:1 to 1:20 batches".

3. PROBLEM (pinned, 4 beats, dark background)
Title: "School alone isn't always enough."
Beat 1: "One teacher, forty students." Animation: 40 dots in a grid, one highlighted dot gets dimmer.
Beat 2: "One speed for everyone." Animation: a line of runners where slower ones fall behind.
Beat 3: "Old methods, new world." Animation: an old chalkboard icon morphing into a tablet outline.
Beat 4: "Nobody tells you what's next." Animation: a path that ends in fog.
Tone: empathetic. Do not blame teachers.

4. THE GAP (off-white)
Headline: "Big coaching centres aren't built for Class 4-10. We are."
Visual: a horizontal timeline of classes 4 to 10 where all seven numbers light up one by one, with a faded "Big coaching focus →" arrow pointing to classes 11-12 and beyond.
Two short paragraphs: big institutes focus on competitive exam prep for senior students, and younger students are left with crowded batches. Stoodant gives this stage the attention it deserves.

5. HOW IT WORKS (white): SVG path draws on scroll, 4 nodes:
1) "Free demo & assessment" 2) "Pick your batch" 3) "Learn at your pace" 4) "Preview what's next".
One sentence of copy per step. Each node pops in as the line reaches it.

6. STAY AHEAD (pinned, dark)
Headline: "Don't just revise. Get ahead."
Explanation: students learn what's coming next in school and how to prepare for it.
Visual: a 3-step staircase labelled "Today", "Next", "Future" where a small figure climbs one step per scroll segment.

7. BATCHES & PRICING (the most important section)
- Heading: "Pick the batch that fits your child."
- Subtext: "Pricing varies by class and batch size. Every batch starts with a free demo."
- 4 cards from SITE_CONFIG.batches, in order 1:1, 1:5, 1:10, 1:20. The 1:5 card has a black "Most Popular" ribbon and is slightly larger on desktop.
- Each card contains: ratio in huge type, batch name, price block (per the offer rules), "/ month", an animated dot diagram (1 large black dot for the teacher, plus N small grey dots for students: 1, 5, 10, 20), a one-line "Best for", and 3 benefit bullets. Button: "Book Free Demo".
- Dot animation: on hover/tap the student dots pulse in sequence and the card lifts. On scroll-in, dots appear one by one.
- Best for / benefits copy:
  - 1:1: "Best for students who need full personal attention." Bullets: fully custom pace, flexible timings, direct teacher focus.
  - 1:5: "Best for focused group learning." Bullets: personal attention, peer learning, balanced price.
  - 1:10: "Best for confident learners who like a classroom feel." Bullets: interactive sessions, regular doubt time, affordable.
  - 1:20: "Best for steady learners on a budget." Bullets: structured lessons, regular practice, most affordable.
- Below the cards: small grey note "Prices are per student, per month. Taxes (if any) extra." as a TODO the owner can edit.

8. WHY STOODANT: a split-screen comparison "Typical tuition" vs "Stoodant". Rows animate in one by one: Crowded batches vs "Choose your batch size"; One pace vs "Your pace"; Rote learning vs "Concept clarity"; No preview vs "Know what's next"; Parents in the dark vs "Parents see progress".

9. SUBJECTS & BOARDS: two infinite marquee rows moving in opposite directions (Row 1: Maths, Science, English, Social Science, Hindi, Computer. Row 2: CBSE, ICSE, Class 4, 5, 6, 7, 8, 9, 10). Marquee pauses on hover.

10. TEACHERS: 4 grayscale placeholder cards (silhouette SVGs, no fake names). Each card reveals a short line on hover: "Trained", "Vetted", "Student-friendly", "Clear explainers". Add a TODO to replace with real teachers.

11. PARENT PROGRESS: an animated mock dashboard with 3 progress rings, a weekly bar chart, and a "Weekly report" card. Mark it "Sample view" in small text. Values are animated placeholders.

12. TESTIMONIALS: 3 placeholder cards labelled in code with TODO. Display "Parent review coming soon" text style placeholders, NOT invented quotes.

13. FAQ: animated accordion with 6 questions: How do batches work? Which boards and classes do you cover? Is there a free demo? Can we switch batches later? Is it online or offline? How do I pay? Write short, honest placeholder answers and add TODOs for the owner to confirm. Do not invent policies like refunds.

14. FINAL CTA (full black): huge "Ready to learn your way?", the ant walking a dotted path toward a flag, and a demo form: Student name, Class (4-10 dropdown), Board (CBSE/ICSE), Parent phone (10-digit Indian number validation), Submit. Success state: the ant reaches the flag, the flag waves, sparks pop, and the form shows "Thank you! We'll call you shortly." If the offer is active, show the offer badge above the form.

15. FOOTER: logo, tagline, quick links, contact from config, © {year} Stoodant.

## EXTRAS
- Floating WhatsApp button (bottom right) linking to https://wa.me/{config.whatsapp} with a prefilled message: "Hi Stoodant, I'd like to book a demo class."
- Form submit: for now, console.log the data and show success. Add a clear TODO to connect to Supabase or email.
- SEO: title "Stoodant | Personalised Tuition for Class 4-10 (CBSE & ICSE)", a meta description, Open Graph tags, a single H1, and a proper heading hierarchy.
- Accessibility: semantic HTML, focus states, aria labels on icon buttons, AA contrast.

## DO NOT
- Do not invent testimonials, results, rankings, awards, or student numbers.
- Do not add any colour outside the palette.
- Do not hard-code prices or offer text outside siteConfig.ts.
- Do not use stock images or emojis.
- Do not leave any section as a placeholder box. Every section must be fully built.

Build sections in order and finish each fully before moving on.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://stoodant1.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fcb02dc3-7b19-467a-945d-ca05e9947bec).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
