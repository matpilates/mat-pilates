import { expect, test } from "@playwright/test";
import { openLanding } from "./support/landing";

test("footer credit preserves links and clears WhatsApp across breakpoints", async ({ page, browserName }) => {
  const runtimeErrors = await openLanding(page);
  const footer = page.getByRole("contentinfo");
  const signature = footer.getByRole("link", { name: "created by VNT" });
  const instagram = footer.getByRole("link", { name: "Instagram", exact: true });

  await expect(signature).toHaveAttribute("href", "https://www.instagram.com/vnt.agencia/");
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
    expect(creditBox.height).toBeGreaterThanOrEqual(44);
    expect(instagramBox.height).toBeGreaterThanOrEqual(44);
    expect(creditBox.x + creditBox.width).toBeLessThanOrEqual(width);

    if (width < 1024) {
      expect(creditBox.x).toBeGreaterThanOrEqual(instagramBox.x + instagramBox.width + 8);
      expect(Math.abs(creditBox.y - instagramBox.y)).toBeLessThanOrEqual(1);
      const whatsapp = page.getByRole("link", { name: "Ir a contacto por WhatsApp" });
      await expect(whatsapp).toBeVisible();
      const whatsappBox = (await whatsapp.boundingBox())!;
      expect(creditBox.y + creditBox.height + 8).toBeLessThanOrEqual(whatsappBox.y);
    } else {
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
  }
  await expect(signature).toBeFocused();
  await expect(signature).toHaveCSS("outline-style", "solid");
  expect(runtimeErrors).toEqual([]);
});

test("footer credit reflows with enlarged mobile text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openLanding(page);
  await page.addStyleTag({ content: "footer { font-size: 200%; } footer a, footer p, footer span { font-size: 2rem !important; }" });
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  const signature = footer.getByRole("link", { name: "created by VNT" });
  const instagram = footer.getByRole("link", { name: "Instagram", exact: true });
  const creditBox = (await signature.boundingBox())!;
  const instagramBox = (await instagram.boundingBox())!;
  expect(creditBox.y).toBeGreaterThanOrEqual(instagramBox.y + instagramBox.height);
  expect(creditBox.x + creditBox.width).toBeLessThanOrEqual(320);
});
