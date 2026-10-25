import { pageFor, redirectFor } from "./routes";

describe("pageFor", () => {
  it("maps each address to its page", () => {
    expect(pageFor("/")).toBe("login");
    expect(pageFor("/login")).toBe("login");
    expect(pageFor("/parent")).toBe("parent");
    expect(pageFor("/teacher/")).toBe("teacher");
    expect(pageFor("/admin")).toBe("admin");
    expect(pageFor("/nope")).toBe("missing");
  });
});

describe("redirectFor", () => {
  const none = { admin: false, teacher: false, parent: false };

  it("lets the team open every page", () => {
    for (const page of ["parent", "teacher", "admin"] as const)
      expect(redirectFor(page, { ...none, admin: true })).toBeNull();
  });

  it("keeps a teacher off the parent and team pages", () => {
    const teacher = { ...none, teacher: true };
    expect(redirectFor("teacher", teacher)).toBeNull();
    expect(redirectFor("parent", teacher)).toBe("/teacher");
    expect(redirectFor("admin", teacher)).toBe("/teacher");
  });

  it("keeps a parent off the teacher and team pages", () => {
    const parent = { ...none, parent: true };
    expect(redirectFor("parent", parent)).toBeNull();
    expect(redirectFor("teacher", parent)).toBe("/parent");
    expect(redirectFor("admin", parent)).toBe("/parent");
  });

  it("lets someone who is both a teacher and a parent open both, but not the team page", () => {
    const both = { ...none, teacher: true, parent: true };
    expect(redirectFor("parent", both)).toBeNull();
    expect(redirectFor("teacher", both)).toBeNull();
    expect(redirectFor("admin", both)).toBe("/teacher");
  });

  it("sends an unknown number back to the log-in page", () => {
    expect(redirectFor("parent", none)).toBe("/login");
  });
});
