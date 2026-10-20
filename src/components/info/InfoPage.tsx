import type { ReactNode } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";
import { PAGES_CONFIG, type InfoPage as InfoPageContent, type InfoSection } from "@/config/pagesConfig";
import { Logo } from "@/brand/Logo";

/** Fills {email}, {phone} and {legalEntity} in page text from the config. */
export function fillText(text: string) {
  return text
    .replaceAll("{email}", SITE_CONFIG.contact.email)
    .replaceAll("{phone}", SITE_CONFIG.contact.phone)
    .replaceAll("{legalEntity}", PAGES_CONFIG.legalEntity);
}

function Section({ section }: { section: InfoSection }) {
  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold sm:text-2xl">{section.heading}</h2>
      {section.paragraphs?.map((text) => <p key={text} className="mt-3 leading-7 text-neutral-700">{fillText(text)}</p>)}
      {section.list && (
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-neutral-700">
          {section.list.map((item) => <li key={item}>{fillText(item)}</li>)}
        </ul>
      )}
    </section>
  );
}

/** Plain, readable layout shared by About, Privacy, Terms and Refund. */
export function InfoPage({ page, path, showUpdated = false, children }: { page: InfoPageContent; path: string; showUpdated?: boolean; children?: ReactNode }) {
  const links = SITE_CONFIG.footer.pages;
  return (
    <div className="min-h-screen bg-white text-[var(--ink)]">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <a href="/" className="logo" aria-label={PAGES_CONFIG.backHome}><Logo /></a>
          <a href="/#demo" className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold" style={{ color: "var(--white)" }}>{SITE_CONFIG.navigation.cta}</a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold leading-tight sm:text-5xl">{page.heading}</h1>
        {showUpdated && <p className="mt-3 text-sm text-neutral-500">{PAGES_CONFIG.lastUpdatedLabel}: {PAGES_CONFIG.lastUpdated}</p>}
        <p className="mt-6 text-lg leading-8">{fillText(page.intro)}</p>
        {page.sections.map((section) => <Section key={section.heading} section={section} />)}
        {children}
        <section className="mt-12 rounded-2xl bg-neutral-100 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">{PAGES_CONFIG.contactHeading}</h2>
          <p className="mt-2 leading-7">{PAGES_CONFIG.contactLead}</p>
          <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-semibold">
            <a className="underline" href={`tel:${SITE_CONFIG.contact.phone.replace(/\s/g, "")}`}>{SITE_CONFIG.contact.phone}</a>
            <a className="underline" href={`https://wa.me/${SITE_CONFIG.contact.whatsapp}`}>WhatsApp</a>
            <a className="underline" href={`mailto:${SITE_CONFIG.contact.email}`}>{SITE_CONFIG.contact.email}</a>
          </p>
        </section>
      </main>
      <footer className="info-footer bg-[var(--ink)] text-white">
        <nav className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-3 px-4 text-sm" aria-label="Stoodant pages">
          <a href="/">{SITE_CONFIG.brand.name}</a>
          {links.map((link) => <a key={link.href} href={link.href} aria-current={link.href === path ? "page" : undefined}>{link.label}</a>)}
        </nav>
        <p className="mx-auto mt-4 max-w-3xl px-4 text-xs text-[var(--grey-3)]">© {new Date().getFullYear()} {SITE_CONFIG.brand.name}. {SITE_CONFIG.footer.rights}</p>
      </footer>
    </div>
  );
}
