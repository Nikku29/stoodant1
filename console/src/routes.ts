import type { Role } from "@/lib/firebase/session";

/** Every page of the app. Anything else shows the not-found page. */
export type Page = "login" | "parent" | "teacher" | "admin" | "missing";

const PAGES: Record<string, Page> = {
  "/": "login",
  "/login": "login",
  "/parent": "parent",
  "/teacher": "teacher",
  "/admin": "admin",
};

export function pageFor(pathname: string): Page {
  const path = pathname.replace(/\/+$/, "") || "/";
  return PAGES[path] ?? "missing";
}

/** Each person's own home page. */
export const HOME: Record<Role, string> = { admin: "/admin", teacher: "/teacher", parent: "/parent" };

/**
 * Where someone may go. The team may open every page (to help a parent or fill in for a teacher);
 * teachers and parents only their own. Returns the page to send them to instead, or null when allowed.
 */
export function redirectFor(
  page: "parent" | "teacher" | "admin",
  who: { admin: boolean; teacher: boolean; parent: boolean },
): string | null {
  if (who.admin) return null;
  if (page === "parent" && who.parent) return null;
  if (page === "teacher" && who.teacher) return null;
  if (who.teacher) return HOME.teacher;
  if (who.parent) return HOME.parent;
  return "/login";
}
