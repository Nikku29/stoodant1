import { expect, test, type Page } from "@playwright/test";

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("home page loads with the hero in the HTML and no console errors", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain("Learning that moves");
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("no horizontal scroll at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  for (let y = 0; y < 30; y++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(80);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("unknown URLs get a real 404", async ({ request }) => {
  expect((await request.get("/this-page-does-not-exist")).status()).toBe(404);
});

test("demo form validates, then books a demo", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/#demo");
  const form = page.locator("#demo form");
  await expect(form).toBeVisible({ timeout: 20_000 });

  await form.getByRole("button", { name: /book my free demo/i }).click();
  await expect(form.getByRole("alert")).toHaveCount(5);

  await form.locator("input[name=parentName]").fill("Anita Sharma");
  await form.locator("select[name=studentClass]").selectOption("7");
  await form.locator("select[name=board]").selectOption("CBSE");
  await form.locator("input[name=phone]").fill(`98${String(Date.now()).slice(-8)}`);
  await form.locator("input[name=consent]").check();
  await page.waitForTimeout(3_200); // the server ignores forms filled faster than a person can
  const response = page.waitForResponse((r) => r.url().endsWith("/api/lead"));
  await form.getByRole("button", { name: /book my free demo/i }).click();
  expect((await response).status()).toBe(200);
  await expect(page.locator("#demo .success")).toBeVisible();
  expect(errors).toEqual([]);
});
