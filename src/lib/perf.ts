import { useEffect, useState } from "react";

/**
 * Central performance tier (CLAUDE.md).
 * "high": desktop, fine pointer, >= 8 cores or unknown.
 * "low": phones, tablets, coarse pointer, width < 1024, <= 4 cores, <= 4 GB memory, Save-Data, or reduced motion.
 * The server and the first client render always assume "low" (the safe, lighter version); high-tier
 * extras switch on after mount, so there is no hydration mismatch.
 */
export type PerfTier = "high" | "low";

type NavigatorHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

export function detectPerfTier(): PerfTier {
  if (typeof window === "undefined") return "low";
  const nav = navigator as NavigatorHints;
  const media = (query: string) => window.matchMedia(query).matches;
  const low =
    media("(pointer: coarse)") ||
    window.innerWidth < 1024 ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 4) ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) ||
    nav.connection?.saveData === true ||
    media("(prefers-reduced-motion: reduce)");
  return low ? "low" : "high";
}

export function usePerfTier(): PerfTier {
  const [tier, setTier] = useState<PerfTier>("low");
  useEffect(() => setTier(detectPerfTier()), []);
  return tier;
}
