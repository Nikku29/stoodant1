import { SITE_CONFIG } from "@/config/siteConfig";
import { BrandLink } from "@/components/sections/shared";

export default function Footer() {
  return <footer><div className="container footer-grid"><BrandLink dark /><div><strong>{SITE_CONFIG.footer.quickLinks}</strong>{SITE_CONFIG.navigation.links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</div><div><strong>{SITE_CONFIG.footer.contact}</strong><a href={`tel:${SITE_CONFIG.contact.phone.replace(/\s/g, "")}`}>{SITE_CONFIG.contact.phone}</a><a href={`mailto:${SITE_CONFIG.contact.email}`}>{SITE_CONFIG.contact.email}</a></div></div><div className="container copyright">© {new Date().getFullYear()} {SITE_CONFIG.brand.name}. {SITE_CONFIG.footer.rights}</div></footer>;
}
