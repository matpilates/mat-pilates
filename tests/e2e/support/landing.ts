import { expect, type Locator, type Page } from "@playwright/test";

export async function openLanding(page: Page) {
  const runtimeErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.route(/https:\/\/www\.google\.com\/maps\/embed.*/, (route) => route.abort());
  // Functional coverage waits for page load and hydration; visual suites own exact font readiness.
  await page.goto("/", { waitUntil: "load" });
  await expectDisclosuresReady(page.locator("details[data-disclosure-group]"));
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      }),
  );

  return runtimeErrors;
}

async function expectDisclosuresReady(disclosures: Locator) {
  await expect
    .poll(() =>
      disclosures.evaluateAll((elements) =>
        elements.every(
          (element) => (element as HTMLElement).dataset.disclosureReady === "true",
        ),
      ),
    )
    .toBe(true);
}
