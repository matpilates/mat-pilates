import { expect, type Page, test } from "@playwright/test";

const visualViewports = [
  { id: "mobile-min", width: 320, height: 568 },
  { id: "mobile", width: 390, height: 844 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "compact-short", width: 1077, height: 609 },
  { id: "compact-content", width: 1280, height: 720 },
  { id: "desktop-boundary", width: 1280, height: 901 },
  { id: "desktop", width: 1440, height: 1000 },
] as const;

async function waitForVisibleImages(page: Page) {
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((image) => {
        const styles = getComputedStyle(image);
        return (
          styles.display !== "none" &&
          styles.visibility !== "hidden" &&
          image.getClientRects().length > 0
        );
      })
      .every((image) => image.complete && image.naturalWidth > 0),
  );
}

async function prepareVisualPage(page: Page) {
  await page.clock.install({ time: new Date("2026-08-03T12:00:00-03:00") });
  await page.route(/https:\/\/www\.google\.com\/maps\/embed.*/, (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const sections = page.locator("main section");
  for (let index = 0; index < (await sections.count()); index += 1) {
    await sections.nth(index).scrollIntoViewIfNeeded();
  }

  await waitForVisibleImages(page);
  // Full-page screenshots preserve sticky positions from the current scroll offset.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) <= 768) {
    await expect
      .poll(() =>
        page
          .locator(".site-header")
          .evaluate((header) => Math.round(header.getBoundingClientRect().top)),
      )
      .toBe(0);
  }
}

test.describe("@visual landing snapshots", () => {
  for (const viewport of visualViewports) {
    test(`${viewport.id} full page`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareVisualPage(page);

      await expect(page).toHaveScreenshot(`${viewport.id}-full.png`, {
        fullPage: true,
        mask: [page.locator(".mat-studio__map")],
        maskColor: "#e1d6c7",
      });

      if (viewport.id === "mobile-min") {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect
          .poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))
          .toBe(true);
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );

        await expect(page.locator(".mat-manifesto")).toHaveScreenshot(
          "mobile-min-reduced-motion-manifesto.png",
          { animations: "disabled" },
        );
        await expect(
          page.locator("#clase-hot-pilates-stretch > summary"),
        ).toHaveScreenshot("mobile-min-reduced-motion-class-title.png", {
          animations: "disabled",
        });
      }
    });
  }

  test("mobile class schedule disclosure", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareVisualPage(page);

    const classCard = page.locator("#clase-mat-pilates");
    await classCard.locator("summary").click();

    await expect(classCard).toHaveScreenshot("mobile-class-schedule-disclosure.png", {
      animations: "disabled",
    });
  });

  test("selected schedule context", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareVisualPage(page);

    const mobileCard = page.locator("#clase-hot-sculpt");
    await mobileCard.locator("summary").click();
    await mobileCard
      .getByRole("link", { name: "Ver horarios de HOT SCULPT" })
      .click();

    const mobileSelectedLink = page
      .locator(
        '.mat-schedule__mobile [data-schedule-class="hot-sculpt"][data-schedule-selected="true"]',
      )
      .first();
    const selectedDay = mobileSelectedLink.locator("xpath=ancestor::details[1]");

    await expect(mobileSelectedLink).toBeFocused();
    await expect(selectedDay).toHaveScreenshot("mobile-selected-schedule-day.png", {
      animations: "disabled",
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const desktopCard = page.locator("#clase-hot-booty");
    await desktopCard.locator("summary").click();
    await desktopCard
      .getByRole("link", { name: "Ver horarios de HOT BOOTY" })
      .click();

    const desktopSelectedLink = page
      .locator(
        '.mat-schedule__desktop [data-schedule-class="hot-booty"][data-schedule-selected="true"]',
      )
      .first();

    await expect(desktopSelectedLink).toBeFocused();
    await waitForVisibleImages(page);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page).toHaveScreenshot("desktop-selected-late-schedule.png", {
      animations: "disabled",
    });
  });
});
