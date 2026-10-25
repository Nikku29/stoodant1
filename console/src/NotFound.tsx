import { Shell } from "@/components/dashboard/Shell";

export default function NotFound() {
  return (
    <Shell role="">
      <section className="pd-card pd-stack">
        <h1>Page not found</h1>
        <p>This page doesn't exist. Your own page is one tap away.</p>
        <a className="pd-cta" href="/">
          Go to my page
        </a>
      </section>
    </Shell>
  );
}
