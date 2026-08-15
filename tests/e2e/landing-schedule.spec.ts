import { expect, type Locator, test } from "@playwright/test";

import { openLanding } from "./support/landing";

async function expectDisclosureOpenSettled(disclosure: Locator) {
  await expect
    .poll(
      () =>
        disclosure.evaluate((card) => {
          const expansion = card.querySelector<HTMLElement>(".mat-disclosure__expansion");
          const body = card.querySelector<HTMLElement>(".mat-disclosure__body");

          if (!expansion || !body) {
            return false;
          }

          const bodyStyles = getComputedStyle(body);
          const translateY =
            bodyStyles.transform === "none"
              ? 0
              : new DOMMatrixReadOnly(bodyStyles.transform).m42;

          return (
            getComputedStyle(expansion).pointerEvents === "auto" &&
            Number.parseFloat(bodyStyles.opacity) >= 0.999 &&
            Math.round(translateY) === 0
          );
        }),
      { timeout: 2500 },
    )
    .toBe(true);
}

test("class cards derive their schedule summaries from the published week", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const matPilatesCard = page.locator("#clase-mat-pilates");
  await matPilatesCard.locator("summary").click();

  const scheduleDays = await matPilatesCard
    .locator(".mat-class-card__schedule-day")
    .evaluateAll((rows) =>
      rows.map((row) => ({
        day: row.querySelector("dt .sr-only")?.textContent,
        shortDay: row.querySelector('dt [aria-hidden="true"]')?.textContent,
        times: Array.from(row.querySelectorAll("time"), (time) => time.textContent),
      })),
    );

  expect(scheduleDays).toEqual([
    { day: "Lunes", shortDay: "Lun", times: ["08.00"] },
    { day: "Martes", shortDay: "Mar", times: ["08.00", "09.00"] },
    { day: "Miércoles", shortDay: "Mie", times: ["08.00"] },
    { day: "Jueves", shortDay: "Jue", times: ["08.00"] },
    { day: "Viernes", shortDay: "Vie", times: ["08.00", "16.00"] },
  ]);
  await expect(matPilatesCard.getByText("Horarios", { exact: true })).toBeVisible();
  await expect(
    matPilatesCard.getByRole("link", {
      name: "Ver horarios de MAT PILATES",
    }),
  ).toHaveAttribute("href", "#horarios");
  const matPilatesExperienceCta = matPilatesCard.getByRole("link", {
    name: "Quiero la experiencia MAT PILATES",
  });
  await expect(matPilatesExperienceCta).toHaveText("Quiero esta experiencia");

  const matPilatesExperienceHref = await matPilatesExperienceCta.getAttribute("href");
  expect(matPilatesExperienceHref).not.toBeNull();
  expect(new URL(matPilatesExperienceHref!).searchParams.get("text")).toBe(
    "Hola, quiero sumarme a MAT. Me interesa MAT PILATES.",
  );
  const ctaLayout = await matPilatesCard.locator(".mat-class-card__cta").evaluateAll((ctas) =>
    ctas.map((cta) => {
      const styles = getComputedStyle(cta);
      return {
        hasOverflow: cta.scrollWidth > cta.clientWidth,
        justifySelf: styles.justifySelf,
        whiteSpace: styles.whiteSpace,
        width: styles.width,
      };
    }),
  );
  expect(ctaLayout).toEqual([
    { hasOverflow: false, justifySelf: "center", whiteSpace: "nowrap", width: "256px" },
    { hasOverflow: false, justifySelf: "center", whiteSpace: "nowrap", width: "256px" },
  ]);

  const yogaCard = page.locator("#clase-yoga");
  await yogaCard.locator("summary").click();
  await expect(yogaCard.locator(".mat-class-card__schedule")).toHaveCount(0);
  await expect(yogaCard.locator(".mat-class-card__schedule-link")).toHaveCount(0);
  await expect(yogaCard.locator(".mat-class-card__cta")).toHaveCount(1);

  const yogaInformationCta = yogaCard.getByRole("link", {
    name: "Quiero información sobre YOGA",
  });
  await expect(yogaInformationCta).toHaveText("Quiero información");
  await expect(yogaInformationCta).toHaveCSS("text-transform", "uppercase");

  const yogaInformationHref = await yogaInformationCta.getAttribute("href");
  expect(yogaInformationHref).not.toBeNull();

  const yogaInformationUrl = new URL(yogaInformationHref!);
  expect(yogaInformationUrl.hostname).toBe("wa.me");
  expect(yogaInformationUrl.searchParams.get("text")).toBe(
    "Hola, quiero información sobre YOGA.",
  );
  await expect(page.locator(".mat-class-card__schedule-link")).toHaveCount(10);

  const informationOnlyClassIds = await page.locator(".mat-class-card").evaluateAll((cards) =>
    cards
      .filter((card) => {
        const ctas = card.querySelectorAll(".mat-class-card__cta");

        return ctas.length === 1 && ctas[0]?.textContent?.trim() === "Quiero información";
      })
      .map((card) => card.id),
  );
  expect(informationOnlyClassIds).toEqual(["clase-yoga"]);

  const occurrenceCounts = await page.evaluate(() => {
    const summaries = Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>(".mat-class-card"), (card) => [
        card.id.replace("clase-", ""),
        card.querySelectorAll(".mat-class-card__schedule-day time").length,
      ]),
    );
    const published: Record<string, number> = {};

    document
      .querySelectorAll<HTMLElement>(".mat-schedule__mobile [data-schedule-class]")
      .forEach((link) => {
        const classId = link.dataset.scheduleClass;

        if (classId) {
          published[classId] = (published[classId] ?? 0) + 1;
        }
      });

    return { published, summaries };
  });

  for (const [classId, summaryCount] of Object.entries(occurrenceCounts.summaries)) {
    expect(summaryCount).toBe(occurrenceCounts.published[classId] ?? 0);
  }
});

test(
  "mobile class-to-schedule navigation opens, announces, and clears the selection",
  { tag: "@cross-browser" },
  async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-08-03T12:00:00-03:00"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await openLanding(page);

    const hotBootyCard = page.locator("#clase-hot-booty");
    await hotBootyCard.locator("summary").click();
    await page.evaluate(() => {
      const originalScrollIntoView = Element.prototype.scrollIntoView;

      Element.prototype.scrollIntoView = function scrollIntoView(options) {
        (window as Window & { matLastScheduleScroll?: ScrollIntoViewOptions })
          .matLastScheduleScroll = typeof options === "object" ? options : undefined;
        originalScrollIntoView.call(this, options);
      };
    });
    await hotBootyCard
      .getByRole("link", { name: "Ver horarios de HOT BOOTY" })
      .click();

    await expect(page).toHaveURL(/#horarios$/);
    await expect(page.locator(".mat-schedule-selection")).toContainText("Horarios de HOT BOOTY");

    const mobileSchedule = page.locator(".mat-schedule__mobile");
    const selectedLinks = mobileSchedule.locator(
      '[data-schedule-class="hot-booty"][data-schedule-selected="true"]',
    );
    const firstSelectedLink = selectedLinks.first();

    await expect(selectedLinks).toHaveCount(4);
    await expect(firstSelectedLink).toBeFocused();
    await expect(firstSelectedLink.locator("xpath=ancestor::details[1]")).toHaveAttribute(
      "open",
      "",
    );

    await firstSelectedLink.evaluate((link) => link.blur());
    const selectedStyles = await firstSelectedLink.evaluate((link) => {
      const styles = getComputedStyle(link);

      return {
        backgroundColor: styles.backgroundColor,
        boxShadow: styles.boxShadow,
      };
    });
    const comparisonBackground = await firstSelectedLink
      .locator("xpath=ancestor::details[1]")
      .locator('.mat-schedule__class-link--high:not([data-schedule-selected="true"])')
      .first()
      .evaluate((link) => getComputedStyle(link).backgroundColor);

    expect(selectedStyles.backgroundColor).toBe(comparisonBackground);
    expect(selectedStyles.boxShadow).toContain("rgb(95, 27, 34) 0px 0px 0px 2px");
    expect(selectedStyles.boxShadow).toContain("rgb(241, 237, 230) 6px 0px 0px 0px inset");
    expect(selectedStyles.boxShadow).toContain("rgb(241, 237, 230) 0px 0px 0px 3px inset");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { matLastScheduleScroll?: ScrollIntoViewOptions })
              .matLastScheduleScroll,
        ),
      )
      .toMatchObject({ behavior: "auto", block: "center" });

    await page.getByRole("button", { name: "Ver todos" }).click();
    await expect(mobileSchedule.locator('[data-schedule-selected="true"]')).toHaveCount(0);
    await expect(page.locator(".mat-schedule-selection")).toHaveCount(0);
    await expect(page.locator("#horarios h2")).toBeFocused();
    await expect(page.locator("#horarios h2")).toBeInViewport();
  },
);

test(
  "mobile menu clears an active schedule selection when navigating away",
  { tag: "@cross-browser" },
  async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-08-03T12:00:00-03:00"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await openLanding(page);

    const hotSculptCard = page.locator("#clase-hot-sculpt");
    await hotSculptCard.locator("summary").click();
    await hotSculptCard
      .getByRole("link", { name: "Ver horarios de HOT SCULPT" })
      .click();

    const scheduleSelection = page.locator(".mat-schedule-selection");
    const selectedLinks = page.locator(
      '.mat-schedule__mobile [data-schedule-class="hot-sculpt"][data-schedule-selected="true"]',
    );

    await expect(page).toHaveURL(/#horarios$/);
    await expect(scheduleSelection).toContainText("Horarios de HOT SCULPT");
    await expect(selectedLinks).toHaveCount(5);

    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page
      .getByRole("navigation", { name: "Navegación móvil" })
      .getByRole("link", { name: "Clases", exact: true })
      .click();

    await expect(page).toHaveURL(/#clases$/);
    await expect(page.locator("#mobile-navigation")).toHaveCount(0);
    await expect(scheduleSelection).toHaveCount(0);
    await expect(selectedLinks).toHaveCount(0);
    await expect(page.locator("#clases h2")).toBeFocused();
  },
);

test(
  "weekly schedule renders the confirmed data without duplicate day-time slots",
  { tag: ["@smoke", "@cross-browser"] },
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const runtimeErrors = await openLanding(page);

    const mobileSchedule = page.locator(".mat-schedule__mobile");
    const days = mobileSchedule.locator(".mat-schedule-day");
    const dayLabels = await days.locator("summary .mat-h3").allTextContents();
    const slotCounts = await days.evaluateAll((elements) =>
      elements.map((element) => element.querySelectorAll(".mat-schedule-day__slot").length),
    );

    expect(dayLabels).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]);
    expect(slotCounts).toEqual([12, 9, 9, 9, 9, 4]);
    await expect(mobileSchedule.locator(".mat-schedule__class-link")).toHaveCount(52);
    await expect(
      mobileSchedule.locator('.mat-schedule__class-link[class*="mat-schedule__class-link--"]'),
    ).toHaveCount(52);
    await expect(mobileSchedule.getByText("Yoga", { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 720 });
    const table = page.locator(".mat-schedule-table");
    const coordinates = await table.locator("tbody td").evaluateAll((cells) =>
      cells
        .filter((cell) => cell.querySelector(".mat-schedule__class-link"))
        .map(
          (cell) =>
            `${cell.getAttribute("data-schedule-day")}-${cell.getAttribute("data-schedule-time")}`,
        ),
    );

    await expect(table.locator("tbody tr")).toHaveCount(12);
    await expect(table.locator(".mat-schedule__class-link")).toHaveCount(52);
    expect(new Set(coordinates).size).toBe(52);
    expect(runtimeErrors).toEqual([]);
  },
);

test("schedule reuses the catalog intensity colors and accessible labels", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-03T12:00:00-03:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const mobileHighLink = page
    .locator(
      ".mat-schedule__mobile .mat-schedule-day[open] .mat-schedule__class-link--high",
    )
    .first();
  await mobileHighLink.focus();
  await expect(mobileHighLink).toHaveCSS("outline-color", "rgb(95, 27, 34)");
  await expect(mobileHighLink).toHaveCSS("outline-width", "2px");
  await expect(mobileHighLink).toHaveCSS("outline-offset", "4px");

  await page.setViewportSize({ width: 1280, height: 720 });

  const desktopModerateLink = page
    .locator(".mat-schedule__desktop .mat-schedule__class-link--moderate")
    .first();
  await desktopModerateLink.focus();
  await expect(desktopModerateLink).toHaveCSS("outline-color", "rgb(250, 218, 221)");
  await expect(desktopModerateLink).toHaveCSS("outline-width", "2px");
  await expect(desktopModerateLink).toHaveCSS("outline-offset", "4px");

  const intensityStyles = await page.evaluate(() =>
    (["low", "moderate", "high"] as const).map((intensity) => {
      const chip = document.querySelector<HTMLElement>(
        `.mat-class-card__intensity--${intensity}`,
      )!;
      const scheduleLink = document.querySelector<HTMLElement>(
        `.mat-schedule__class-link--${intensity}`,
      )!;
      const chipStyles = getComputedStyle(chip);
      const scheduleStyles = getComputedStyle(scheduleLink);

      return {
        chip: {
          background: chipStyles.backgroundColor,
          color: chipStyles.color,
        },
        schedule: {
          background: scheduleStyles.backgroundColor,
          color: scheduleStyles.color,
        },
      };
    }),
  );

  for (const styles of intensityStyles) {
    expect(styles.schedule).toEqual(styles.chip);
  }

  await expect(page.locator(".mat-schedule__class-link--low").first()).toHaveAttribute(
    "aria-label",
    /intensidad baja/i,
  );
  await expect(page.locator(".mat-schedule__class-link--moderate").first()).toHaveAttribute(
    "aria-label",
    /intensidad moderada/i,
  );
  await expect(page.locator(".mat-schedule__class-link--high").first()).toHaveAttribute(
    "aria-label",
    /intensidad alta/i,
  );
});

test("intense desktop schedule links retain their hover cue", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openLanding(page);

  const intenseLink = page.locator(".mat-schedule__desktop .mat-schedule__class-link--high").first();
  const restingBoxShadow = await intenseLink.evaluate((link) => getComputedStyle(link).boxShadow);

  await intenseLink.hover();
  await expect
    .poll(() => intenseLink.evaluate((link) => getComputedStyle(link).boxShadow))
    .toContain("2px");
  await expect(intenseLink).not.toHaveCSS("box-shadow", restingBoxShadow);
});

test("schedule accordions are exclusive and class links reveal their catalog card", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-08-03T12:00:00-03:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const days = page.locator(".mat-schedule__mobile .mat-schedule-day");
  await expect(days.nth(0)).toHaveAttribute("open", "");
  await expect(days.nth(1)).not.toHaveAttribute("open", "");

  await days.nth(1).locator("summary").click();
  await expect(days.nth(0)).not.toHaveAttribute("open", "");
  await expect(days.nth(1)).toHaveAttribute("open", "");

  await days.nth(1).locator(".mat-schedule__class-link").first().click();
  const classCard = page.locator("#clase-mat-pilates");

  await expect(page).toHaveURL(/#clase-mat-pilates$/);
  await expect(classCard).toHaveAttribute("open", "");
  await expect(classCard.locator("summary")).toBeFocused();
});

test("desktop class-to-schedule selection preserves the reverse catalog link", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1765, height: 320 });
  await openLanding(page);

  const hotBootyCard = page.locator("#clase-hot-booty");
  await hotBootyCard.locator("summary").click();
  await page.evaluate(() => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;

    Element.prototype.scrollIntoView = function scrollIntoView(options) {
      (window as Window & { matLastScheduleScroll?: ScrollIntoViewOptions })
        .matLastScheduleScroll = typeof options === "object" ? options : undefined;
      originalScrollIntoView.call(this, options);
    };
  });
  await hotBootyCard
    .getByRole("link", { name: "Ver horarios de HOT BOOTY" })
    .click();

  const selectedLinks = page.locator(
    '.mat-schedule__desktop [data-schedule-class="hot-booty"][data-schedule-selected="true"]',
  );
  const firstSelectedLink = selectedLinks.first();
  const scheduleHeading = page.locator(".mat-schedule__heading");
  const selectionStatus = page.locator(".mat-schedule-selection");

  await expect(selectedLinks).toHaveCount(4);
  await expect(firstSelectedLink).toBeFocused();
  await expect(scheduleHeading).toHaveCSS("position", "static");
  await expect(selectionStatus).toHaveCSS("position", "sticky");
  await expect(selectionStatus).toContainText("Horarios de HOT BOOTY");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { matLastScheduleScroll?: ScrollIntoViewOptions })
            .matLastScheduleScroll,
      ),
    )
    .toMatchObject({ behavior: "auto", block: "start" });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const target = document.querySelector<HTMLElement>(
          '.mat-schedule__desktop [data-schedule-class="hot-booty"][data-schedule-selected="true"]',
        )!;
        const dayHeader = document.querySelector<HTMLElement>(".mat-schedule-table__day")!;
        const targetStyles = getComputedStyle(target);
        const focusExtent =
          Number.parseFloat(targetStyles.outlineWidth) +
          Number.parseFloat(targetStyles.outlineOffset);

        return (
          target.getBoundingClientRect().top -
          focusExtent -
          dayHeader.getBoundingClientRect().bottom
        );
      }),
    )
    .toBeGreaterThanOrEqual(8);

  const geometry = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".site-header")!.getBoundingClientRect();
    const status = document
      .querySelector<HTMLElement>(".mat-schedule-selection")!
      .getBoundingClientRect();
    const targetElement = document.querySelector<HTMLElement>(
      '.mat-schedule__desktop [data-schedule-class="hot-booty"][data-schedule-selected="true"]',
    )!;
    const target = targetElement.getBoundingClientRect();
    const targetStyles = getComputedStyle(targetElement);
    const focusExtent =
      Number.parseFloat(targetStyles.outlineWidth) + Number.parseFloat(targetStyles.outlineOffset);

    return {
      headerBottom: header.bottom,
      statusTop: status.top,
      statusBottom: status.bottom,
      dayHeaders: Array.from(
        document.querySelectorAll<HTMLElement>(".mat-schedule-table__day"),
        (dayHeader) => {
          const rect = dayHeader.getBoundingClientRect();

          return { top: rect.top, bottom: rect.bottom };
        },
      ),
      focusExtent,
      targetTop: target.top,
      targetBottom: target.bottom,
      viewportHeight: window.innerHeight,
    };
  });

  expect(geometry.statusTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
  expect(geometry.statusTop).toBeLessThanOrEqual(geometry.headerBottom + 1);
  expect(geometry.dayHeaders).toHaveLength(6);
  for (const dayHeader of geometry.dayHeaders) {
    expect(dayHeader.top).toBeGreaterThanOrEqual(geometry.statusBottom - 1);
    expect(geometry.targetTop - geometry.focusExtent).toBeGreaterThanOrEqual(
      dayHeader.bottom + 8,
    );
    expect(dayHeader.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
  }
  expect(geometry.targetBottom + geometry.focusExtent).toBeLessThanOrEqual(
    geometry.viewportHeight,
  );

  await firstSelectedLink.evaluate((link) => link.blur());
  const highStyles = await firstSelectedLink.evaluate((link) => {
    const styles = getComputedStyle(link);

    return { backgroundColor: styles.backgroundColor, boxShadow: styles.boxShadow };
  });

  expect(highStyles.backgroundColor).toBe("rgb(95, 27, 34)");
  expect(highStyles.boxShadow).toContain("rgb(250, 218, 221) 0px 0px 0px 2px");
  expect(highStyles.boxShadow).toContain("rgb(241, 237, 230) 6px 0px 0px 0px inset");

  await firstSelectedLink.click();

  await expect(page).toHaveURL(/#clase-hot-booty$/);
  await expect(hotBootyCard).toHaveAttribute("open", "");
  await expect(hotBootyCard.locator("summary")).toBeFocused();
  await expect(page.locator(".mat-schedule-selection")).toHaveCount(0);

  const stretchingCard = page.locator("#clase-stretching");
  await stretchingCard.locator("summary").click();
  await stretchingCard
    .getByRole("link", { name: "Ver horarios de STRETCHING" })
    .click();

  const lowSelectedLink = page
    .locator(
      '.mat-schedule__desktop [data-schedule-class="stretching"][data-schedule-selected="true"]',
    )
    .first();
  await expect(lowSelectedLink).toBeFocused();
  await lowSelectedLink.evaluate((link) => link.blur());
  const lowStyles = await lowSelectedLink.evaluate((link) => {
    const styles = getComputedStyle(link);

    return { backgroundColor: styles.backgroundColor, boxShadow: styles.boxShadow };
  });

  expect(lowStyles.backgroundColor).toBe("rgb(226, 217, 205)");
  expect(lowStyles.boxShadow).toContain("rgb(250, 218, 221) 0px 0px 0px 2px");
  expect(lowStyles.boxShadow).toContain("rgb(43, 43, 43) 6px 0px 0px 0px inset");

  await lowSelectedLink.click();
  await expect(stretchingCard).toHaveAttribute("open", "");

  const absOnCard = page.locator("#clase-abs-on");
  await absOnCard.locator("summary").click();
  await absOnCard.getByRole("link", { name: "Ver horarios de ABS ON" }).click();

  const moderateSelectedLink = page
    .locator(
      '.mat-schedule__desktop [data-schedule-class="abs-on"][data-schedule-selected="true"]',
    )
    .first();
  await expect(moderateSelectedLink).toBeFocused();
  await moderateSelectedLink.evaluate((link) => link.blur());
  const moderateStyles = await moderateSelectedLink.evaluate((link) => {
    const styles = getComputedStyle(link);

    return { backgroundColor: styles.backgroundColor, boxShadow: styles.boxShadow };
  });

  expect(moderateStyles.backgroundColor).toBe("rgb(250, 218, 221)");
  expect(moderateStyles.boxShadow).toContain("rgb(250, 218, 221) 0px 0px 0px 2px");
  expect(moderateStyles.boxShadow).toContain("rgb(95, 27, 34) 6px 0px 0px 0px inset");

  await page.getByRole("button", { name: "Ver todos" }).click();
  await expect(
    page.locator('.mat-schedule__desktop [data-schedule-selected="true"]'),
  ).toHaveCount(0);
  await expect(page.locator(".mat-schedule-selection")).toHaveCount(0);
  await expect(page.locator("#horarios h2")).toBeFocused();
  await expect(page.locator("#horarios h2")).toBeInViewport();

  await page.setViewportSize({ width: 1024, height: 568 });
  await hotBootyCard.locator("summary").click();
  await hotBootyCard
    .getByRole("link", { name: "Ver horarios de HOT BOOTY" })
    .click();

  const boundarySelectedLink = page
    .locator(
      '.mat-schedule__desktop [data-schedule-class="hot-booty"][data-schedule-selected="true"]',
    )
    .first();
  await expect(page.locator(".mat-schedule__desktop")).toBeVisible();
  await expect(page.locator(".mat-schedule__mobile")).toBeHidden();
  await expect(boundarySelectedLink).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const target = document.querySelector<HTMLElement>(
          '.mat-schedule__desktop [data-schedule-class="hot-booty"][data-schedule-selected="true"]',
        )!;
        const dayHeader = document.querySelector<HTMLElement>(".mat-schedule-table__day")!;
        const targetStyles = getComputedStyle(target);
        const focusExtent =
          Number.parseFloat(targetStyles.outlineWidth) +
          Number.parseFloat(targetStyles.outlineOffset);

        return (
          target.getBoundingClientRect().top -
          focusExtent -
          dayHeader.getBoundingClientRect().bottom
        );
      }),
    )
    .toBeGreaterThanOrEqual(8);
});

test(
  "desktop smooth schedule navigation settles below sticky context",
  { tag: "@cross-browser" },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1765, height: 320 });
    await openLanding(page);

    const hotBootyCard = page.locator("#clase-hot-booty");
    await hotBootyCard.locator("summary").click();
    await expectDisclosureOpenSettled(hotBootyCard);
    await page.evaluate(() => {
      const originalScrollIntoView = Element.prototype.scrollIntoView;

      Element.prototype.scrollIntoView = function scrollIntoView(options) {
        const browserWindow = window as Window & {
          matScheduleScrolls?: ScrollIntoViewOptions[];
        };

        browserWindow.matScheduleScrolls ??= [];
        if (typeof options === "object") {
          browserWindow.matScheduleScrolls.push(options);
        }
        originalScrollIntoView.call(this, options);
      };
    });
    await hotBootyCard
      .getByRole("link", { name: "Ver horarios de HOT BOOTY" })
      .click();

    const selectedLink = page
      .locator(
        '.mat-schedule__desktop [data-schedule-class="hot-booty"][data-schedule-selected="true"]',
      )
      .first();
    await expect(selectedLink).toBeFocused();

    const settledGeometry = await page.evaluate(
      () =>
        new Promise<{
          focusExtent: number;
          gap: number;
          targetBottom: number;
          viewportHeight: number;
        }>((resolve, reject) => {
          const deadline = performance.now() + 5000;
          let lastScrollY = window.scrollY;
          let stableFrames = 0;

          const inspectFrame = () => {
            const target = document.querySelector<HTMLElement>(
              '.mat-schedule__desktop [data-schedule-class="hot-booty"][data-schedule-selected="true"]',
            );
            const dayHeader = document.querySelector<HTMLElement>(".mat-schedule-table__day");

            if (!target || !dayHeader) {
              reject(new Error("Schedule target or sticky day header is missing."));
              return;
            }

            const targetRect = target.getBoundingClientRect();
            const targetStyles = getComputedStyle(target);
            const focusExtent =
              Number.parseFloat(targetStyles.outlineWidth) +
              Number.parseFloat(targetStyles.outlineOffset);
            const gap =
              targetRect.top - focusExtent - dayHeader.getBoundingClientRect().bottom;
            const targetIsVisible = targetRect.bottom + focusExtent <= window.innerHeight;
            const scrollIsStable = Math.abs(window.scrollY - lastScrollY) < 0.5;

            stableFrames = scrollIsStable && gap >= 8 && targetIsVisible ? stableFrames + 1 : 0;
            lastScrollY = window.scrollY;

            if (stableFrames >= 4) {
              resolve({
                focusExtent,
                gap,
                targetBottom: targetRect.bottom,
                viewportHeight: window.innerHeight,
              });
              return;
            }

            if (performance.now() >= deadline) {
              reject(new Error("Smooth schedule scroll did not settle below the sticky context."));
              return;
            }

            window.requestAnimationFrame(inspectFrame);
          };

          window.requestAnimationFrame(inspectFrame);
        }),
    );
    const scrollCalls = await page.evaluate(
      () =>
        (window as Window & { matScheduleScrolls?: ScrollIntoViewOptions[] })
          .matScheduleScrolls ?? [],
    );

    expect(scrollCalls).toEqual([
      { behavior: "smooth", block: "start" },
      { behavior: "smooth", block: "start" },
    ]);
    expect(settledGeometry.gap).toBeGreaterThanOrEqual(8);
    expect(settledGeometry.targetBottom + settledGeometry.focusExtent).toBeLessThanOrEqual(
      settledGeometry.viewportHeight,
    );
  },
);


test("schedule opens the current day and falls back to Monday on Sunday", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-08-04T12:00:00-03:00") });
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const days = page.locator(".mat-schedule__mobile .mat-schedule-day");
  await expect(days.nth(0)).not.toHaveAttribute("open", "");
  await expect(days.nth(1)).toHaveAttribute("open", "");

  await page.clock.setFixedTime(new Date("2026-08-09T12:00:00-03:00"));
  await page.reload();

  await expect(days.nth(0)).toHaveAttribute("open", "");
  await expect(days.nth(1)).not.toHaveAttribute("open", "");
});
