import { SITE_CONFIG } from "@/config/siteConfig";
import { InfoPage } from "@/components/info/InfoPage";
import { BLOG, BLOG_POSTS, blogPostPath, type BlogPost } from "@/content/blog";

const site = SITE_CONFIG.siteUrl;
const ORG = { "@type": "Organization", "@id": `${site}/#organization`, name: SITE_CONFIG.brand.name, url: `${site}/` };

/** Static JSON-LD built from the post data in this module (never from the page), with "<" escaped. */
function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function PostList({ posts }: { posts: readonly BlogPost[] }) {
  return (
    <ul className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200">
      {posts.map((post) => (
        <li key={post.slug} className="py-5">
          <a href={blogPostPath(post.slug)} className="font-[family-name:var(--font-display)] text-lg font-bold underline-offset-4 hover:underline">{post.heading}</a>
          <p className="mt-1 leading-7 text-neutral-700">{post.description}</p>
        </li>
      ))}
    </ul>
  );
}

export function BlogIndexPage() {
  const page = { heading: BLOG.heading, intro: BLOG.intro, sections: [] };
  return (
    <InfoPage page={page} path={BLOG.path}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": `${site}${BLOG.path}#blog`,
        name: BLOG.heading,
        url: `${site}${BLOG.path}`,
        inLanguage: "en-IN",
        publisher: ORG,
        blogPost: BLOG_POSTS.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: `${site}${blogPostPath(post.slug)}`, datePublished: post.date })),
      }} />
      <PostList posts={BLOG_POSTS} />
    </InfoPage>
  );
}

export function BlogPostPage({ post }: { post: BlogPost }) {
  const url = `${site}${blogPostPath(post.slug)}`;
  const others = BLOG_POSTS.filter((other) => other.slug !== post.slug).slice(0, 3);
  return (
    <InfoPage page={post} path={blogPostPath(post.slug)} byline={`${BLOG.author} · ${BLOG.publishedLabel} ${formatDate(post.date)}`}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        url,
        mainEntityOfPage: url,
        datePublished: post.date,
        dateModified: post.date,
        inLanguage: "en-IN",
        image: `${site}/og-image.png`,
        author: ORG,
        publisher: { ...ORG, logo: { "@type": "ImageObject", url: `${site}/apple-touch-icon.png` } },
        isPartOf: { "@id": `${site}${BLOG.path}#blog` },
      }} />
      <section className="mt-12 rounded-2xl bg-[var(--ink)] p-6 text-white">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">{BLOG.ctaHeading}</h2>
        <p className="mt-2 leading-7 text-neutral-200">{BLOG.ctaCopy}</p>
        <a href="/#demo" className="mt-4 inline-block rounded-full bg-white px-5 py-3 text-sm font-semibold" style={{ color: "var(--ink)" }}>{BLOG.ctaButton}</a>
      </section>
      <section className="mt-12">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold sm:text-2xl">{BLOG.nextHeading}</h2>
        <PostList posts={others} />
        <a href={BLOG.path} className="mt-4 inline-block font-semibold underline">{BLOG.allPosts}</a>
      </section>
    </InfoPage>
  );
}
