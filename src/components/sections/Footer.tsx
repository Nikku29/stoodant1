import { SITE_CONFIG } from "@/config/siteConfig";
import { BrandLink } from "@/components/sections/shared";
import { appHref } from "@/lib/appUrl";

export default function Footer() {
  return <footer><div className="container footer-grid"><div><BrandLink dark /><p className="footer-about">{SITE_CONFIG.footer.about}</p></div><div className="footer-links"><strong>{SITE_CONFIG.footer.quickLinks}</strong>{SITE_CONFIG.navigation.links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}{SITE_CONFIG.footer.pages.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}<a href={appHref("/login")}>{SITE_CONFIG.footer.login}</a></div><div><strong>{SITE_CONFIG.footer.contact}</strong><a href={`tel:${SITE_CONFIG.contact.phone.replace(/\s/g, "")}`}>{SITE_CONFIG.contact.phone}</a><a href={`mailto:${SITE_CONFIG.contact.email}`}>{SITE_CONFIG.contact.email}</a>{SITE_CONFIG.social.map((profile) => <a key={profile.href} href={profile.href} rel="me noopener" target="_blank">{profile.label}</a>)}</div></div><div className="container copyright">© {new Date().getFullYear()} {SITE_CONFIG.brand.name}. {SITE_CONFIG.footer.rights}</div></footer>;
}
