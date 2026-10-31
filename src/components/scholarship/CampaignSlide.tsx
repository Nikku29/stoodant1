import type { CSSProperties } from "react";
import { SITE_CONFIG } from "@/config/siteConfig";

/** The scholarship campaign poster: home page's first slide and the top of /scholarship. Text in SITE_CONFIG.scholarship. */
export function CampaignSlide({ ctaHref }: { ctaHref: string }) {
  const s = SITE_CONFIG.scholarship;
  return (
    <div className="cb-slide cb-campaign">
      <div className="cb-copy">
        <p className="cb-kicker">{s.kicker}</p>
        <p className="cb-title">{s.headline[0]} <b>{s.headline[1]}</b> {s.headline[2]}</p>
        <p className="cb-sub">{s.sub}</p>
        <a className="cb-cta" href={ctaHref}>{s.cta}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 7l10 10M17 7v10H7" /></svg></a>
      </div>
      <ol className="cb-tiers">{s.tiers.map(([rank, pct]) => <li key={rank} style={{ "--w": pct } as CSSProperties}><span>{rank}</span><b>{pct}</b></li>)}</ol>
      <small className="cb-note">{s.note}</small>
    </div>
  );
}
