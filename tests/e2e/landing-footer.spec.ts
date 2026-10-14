import { expect, test } from "@playwright/test";
import { openLanding } from "./support/landing";

test("footer credit preserves links and clears WhatsApp across breakpoints", async ({ page, browserName }) => {
  const runtimeErrors = await openLanding(page);
  const footer = page.getByRole("contentinfo");
  const signature = footer.getByRole("link", { name: "Sitio web de VNT Agencia" });
  const brand = footer.getByRole("link", { name: "MAT Pilates, inicio" });
  const instagram = footer.getByRole("link", { name: "Instagram", exact: true });
  const location = footer.getByRole("link", { name: /MAT Pilates.*Canning/i });
  const navigation = footer.getByRole("navigation");

  await expect(signature).toHaveAttribute("href", "https://vntagencia.com/r/mat-pilates");
  await expect(signature).toHaveAttribute("data-vnt-signature", "mat-pilates");
  await expect(signature).toHaveAttribute("target", "_blank");
  await expect(signature).toHaveAttribute("rel", "noopener noreferrer");
  await expect(instagram).toHaveAttribute("href", "https://www.instagram.com/matpilatescn/");

  for (const width of [320, 390, 768, 1023, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await footer.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(signature).toBeVisible();
    const creditBox = (await signature.boundingBox())!;
    const instagramBox = (await instagram.boundingBox())!;
    const brandBox = (await brand.boundingBox())!;
    expect(creditBox.height).toBeGreaterThanOrEqual(44);
    expect(instagramBox.height).toBeGreaterThanOrEqual(44);
    expect(creditBox.x + creditBox.width).toBeLessThanOrEqual(width);

    if (width < 1024) {
      if (width < 768) {
        expect(creditBox.x).toBeGreaterThanOrEqual(brandBox.x + brandBox.width + 8);
        expect(Math.abs(creditBox.y + creditBox.height / 2 - brandBox.y - brandBox.height / 2)).toBeLessThanOrEqual(1);
        expect(instagramBox.y).toBeGreaterThanOrEqual(creditBox.y + creditBox.height);
      } else {
        expect(creditBox.x).toBeGreaterThanOrEqual(instagramBox.x + instagramBox.width + 8);
        expect(Math.abs(creditBox.y - instagramBox.y)).toBeLessThanOrEqual(1);
      }
      const whatsapp = page.getByRole("link", { name: "Ir a contacto por WhatsApp" });
      await expect(whatsapp).toBeVisible();
      const whatsappBox = (await whatsapp.boundingBox())!;
      expect(creditBox.y + creditBox.height + 8).toBeLessThanOrEqual(whatsappBox.y);
    } else {
      const navigationBox = (await navigation.boundingBox())!;
      const locationBox = (await location.boundingBox())!;
      expect(Math.abs(instagramBox.y + instagramBox.height / 2 - brandBox.y - brandBox.height / 2)).toBeLessThanOrEqual(1);
      expect(locationBox.y).toBeGreaterThanOrEqual(navigationBox.y + navigationBox.height + 24);
      expect(creditBox.y).toBeGreaterThanOrEqual(locationBox.y);
      expect(creditBox.y).toBeGreaterThanOrEqual(instagramBox.y + instagramBox.height);
      expect(Math.abs(creditBox.x + creditBox.width - instagramBox.x - instagramBox.width)).toBeLessThanOrEqual(1);
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  await instagram.focus();
  if (browserName === "webkit" && process.platform === "win32") {
    // Windows WebKit excludes links from sequential Tab navigation.
    await signature.focus();
  } else {
    await page.keyboard.press("Tab");
    await expect(location).toBeFocused();
    await page.keyboard.press("Tab");
  }
  await expect(signature).toBeFocused();
  await expect(signature).toHaveCSS("outline-style", "solid");
  expect(runtimeErrors).toEqual([]);
});

test("desktop footer keeps both levels usable with enlarged text", async ({ page }) => {
  await openLanding(page);
  await page.addStyleTag({ content: "footer a, footer p, footer span { font-size: 2rem !important; line-height: 1.5 !important; }" });
  const footer = page.getByRole("contentinfo");
  const navigation = footer.getByRole("navigation");
  const location = footer.getByRole("link", { name: /MAT Pilates.*Canning/i });
  const signature = footer.getByRole("link", { name: "Sitio web de VNT Agencia" });

  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await footer.scrollIntoViewIfNeeded();
    const navigationBox = (await navigation.boundingBox())!;
    const locationBox = (await location.boundingBox())!;
    const creditBox = (await signature.boundingBox())!;
    expect(locationBox.y).toBeGreaterThanOrEqual(navigationBox.y + navigationBox.height + 24);
    expect(locationBox.x + locationBox.width + 8).toBeLessThanOrEqual(creditBox.x);
    expect(creditBox.x + creditBox.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const link of await footer.getByRole("link").all()) {
      await expect(link).toBeVisible();
    }
  }
});

test("footer credit reflows with enlarged mobile text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openLanding(page);
  await page.addStyleTag({ content: "footer { font-size: 200%; } footer a, footer p, footer span { font-size: 2rem !important; }" });
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  const signature = footer.getByRole("link", { name: "Sitio web de VNT Agencia" });
  const brand = footer.getByRole("link", { name: "MAT Pilates, inicio" });
  const creditBox = (await signature.boundingBox())!;
  const brandBox = (await brand.boundingBox())!;
  expect(creditBox.y).toBeGreaterThanOrEqual(brandBox.y + brandBox.height);
  expect(creditBox.x + creditBox.width).toBeLessThanOrEqual(320);
});

test("footer navigation stays contained at 200% text across breakpoints @cross-browser", async ({ page, browserName }) => {
  const runtimeErrors = await openLanding(page);
  await page.evaluate(() => document.fonts.ready);
  const footer = page.getByRole("contentinfo");
  const navigation = footer.getByRole("navigation");
  const links = navigation.getByRole("link");
  const signature = footer.getByRole("link", { name: "Sitio web de VNT Agencia" });

  for (const width of [320, 390, 768, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await footer.evaluate((element) => {
      const textElements = Array.from(element.querySelectorAll<HTMLElement>("ul, a, p, span"));
      const sizes = textElements.map((textElement) => parseFloat(getComputedStyle(textElement).fontSize));
      textElements.forEach((textElement, index) => {
        textElement.style.fontSize = `${sizes[index] * 2}px`;
      });
    });
    await footer.scrollIntoViewIfNeeded();
    const navigationBox = (await navigation.boundingBox())!;
    const list = navigation.getByRole("list");
    expect(await list.evaluate((element) => element.scrollWidth - element.clientWidth), `${width}px navigation`).toBeLessThanOrEqual(1);
    expect(await links.count()).toBe(4);

    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (const link of await links.all()) {
      await expect(link).toBeVisible();
      const box = (await link.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(navigationBox.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(navigationBox.x + navigationBox.width + 1);
      expect(box.y).toBeGreaterThanOrEqual(navigationBox.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(navigationBox.y + navigationBox.height + 1);
      for (const previous of boxes) {
        const overlapX = Math.min(previous.x + previous.width, box.x + box.width) - Math.max(previous.x, box.x);
        const overlapY = Math.min(previous.y + previous.height, box.y + box.height) - Math.max(previous.y, box.y);
        expect(overlapX <= 0 || overlapY <= 0).toBe(true);
      }
      boxes.push(box);
    }

    await links.first().focus();
    for (let index = 0; index < 4; index++) {
      const link = links.nth(index);
      if (index > 0) {
        if (browserName === "webkit" && process.platform === "win32") {
          await link.focus();
        } else {
          await page.keyboard.press("Tab");
        }
      }
      await expect(link).toBeFocused();
      await expect(link).toHaveCSS("outline-style", "solid");
      const box = (await link.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(6);
      expect(box.x + box.width + 6).toBeLessThanOrEqual(width);
    }

    const creditBox = (await signature.boundingBox())!;
    expect(creditBox.height).toBeGreaterThanOrEqual(44);
    expect(creditBox.x + creditBox.width).toBeLessThanOrEqual(width);
  }
  expect(runtimeErrors).toEqual([]);
});
