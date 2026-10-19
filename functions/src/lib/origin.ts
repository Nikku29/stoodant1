/**
 * Exact-match allow-list for the Origin header. An entry may contain one `*`, which matches a single
 * DNS label fragment (letters, digits, hyphens), for preview channels like `https://stoodant-staging--*.web.app`.
 */
export function isAllowedOrigin(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return false;
  return allowed.some((entry) => {
    if (!entry.includes("*")) return entry === origin;
    const [head, tail] = entry.split("*", 2) as [string, string];
    if (!origin.startsWith(head) || !origin.endsWith(tail) || origin.length <= head.length + tail.length) return false;
    return /^[a-z0-9-]+$/i.test(origin.slice(head.length, origin.length - tail.length));
  });
}
