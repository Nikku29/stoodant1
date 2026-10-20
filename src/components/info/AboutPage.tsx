import { SITE_CONFIG } from "@/config/siteConfig";
import { PAGES_CONFIG } from "@/config/pagesConfig";
import { PAGES_META } from "@/config/pagesMeta";
import { InfoPage } from "@/components/info/InfoPage";

const about = PAGES_CONFIG.about;
const teacherById = new Map<string, (typeof SITE_CONFIG.teachers.slides)[number]>(SITE_CONFIG.teachers.slides.map((teacher) => [teacher.id, teacher]));

/** About: the shared info layout plus founders, teachers and how classes work, all from siteConfig. */
export function AboutPage() {
  return (
    <InfoPage page={about} path={PAGES_META.about.path}>
      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold sm:text-2xl">{about.foundersHeading}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {SITE_CONFIG.founders.map((founder) => {
            const teacher = teacherById.get(founder.id);
            return (
              <li key={founder.id} className="rounded-2xl border border-neutral-200 p-5">
                <p className="font-[family-name:var(--font-display)] text-lg font-bold">{founder.name}</p>
                <p className="text-sm text-neutral-600">{founder.jobTitle}</p>
                {teacher && <p className="mt-2 text-sm leading-6 text-neutral-700">{teacher.highlights.join(" · ")}</p>}
                {teacher?.quote && <p className="mt-3 text-sm italic leading-6 text-neutral-700">“{teacher.quote}”</p>}
                <a className="mt-3 inline-block text-sm font-semibold underline" href={founder.linkedin} rel="noopener" target="_blank">LinkedIn</a>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold sm:text-2xl">{about.teachersHeading}</h2>
        <p className="mt-3 leading-7 text-neutral-700">{about.teachersLead}</p>
        <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
          {SITE_CONFIG.teachers.slides.map((teacher) => (
            <li key={teacher.id} className="py-3">
              <p className="font-semibold">{teacher.name} <span className="font-normal text-neutral-600">· {teacher.role ?? `${SITE_CONFIG.teachers.teaches} ${teacher.subject}`}</span></p>
              <p className="text-sm leading-6 text-neutral-700">{teacher.highlights.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold sm:text-2xl">{about.howHeading}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-neutral-700">
          {about.howFacts.map((fact) => <li key={fact}>{fact}</li>)}
          <li>{SITE_CONFIG.subjects.rowOne.join(", ")}, for Class 4 to 10, CBSE and ICSE.</li>
        </ul>
        <ol className="mt-5 space-y-3">
          {SITE_CONFIG.process.steps.map((step) => (
            <li key={step.number} className="flex gap-4"><span className="font-[family-name:var(--font-display)] font-bold text-neutral-400">{step.number}</span><span><strong>{step.title}.</strong> {step.copy}</span></li>
          ))}
        </ol>
      </section>
    </InfoPage>
  );
}
