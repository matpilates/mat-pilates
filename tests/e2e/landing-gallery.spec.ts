import { expect, test, type Locator, type Page } from "@playwright/test";

import { openLanding } from "./support/landing";

type GalleryFrame = {
  activeIndex: string | undefined;
  animating: boolean;
  left: number;
  right: number;
  slides: Array<{
    complete: boolean;
    index: string | undefined;
    naturalWidth: number;
    width: number;
    x: number;
    zIndex: number;
  }>;
};

async function startGallerySampling(gallery: Locator) {
  await gallery.evaluate((element) => {
    const galleryWindow = window as typeof window & {
      __studioGalleryFrame?: number;
      __studioGallerySamples?: GalleryFrame[];
    };

    galleryWindow.__studioGallerySamples = [];

    const sampleFrame = () => {
      const galleryBounds = element.getBoundingClientRect();
      const slides = Array.from(
        element.querySelectorAll<HTMLElement>(".mat-studio-gallery__slide"),
      ).map((slide) => {
        const image = slide.querySelector("img");
        const bounds = slide.getBoundingClientRect();

        return {
          complete: image?.complete ?? false,
          index: slide.dataset.studioImageIndex,
          naturalWidth: image?.naturalWidth ?? 0,
          width: bounds.width,
          x: bounds.x,
          zIndex: Number.parseInt(getComputedStyle(slide).zIndex, 10),
        };
      });

      galleryWindow.__studioGallerySamples?.push({
        activeIndex: element.dataset.studioActiveIndex,
        animating: element.dataset.studioAnimating === "true",
        left: galleryBounds.left,
        right: galleryBounds.right,
        slides,
      });
      galleryWindow.__studioGalleryFrame = requestAnimationFrame(sampleFrame);
    };

    sampleFrame();
  });
}

async function stopGallerySampling(gallery: Locator) {
  return gallery.evaluate(() => {
    const galleryWindow = window as typeof window & {
      __studioGalleryFrame?: number;
      __studioGallerySamples?: GalleryFrame[];
    };

    if (galleryWindow.__studioGalleryFrame !== undefined) {
      cancelAnimationFrame(galleryWindow.__studioGalleryFrame);
    }

    return galleryWindow.__studioGallerySamples ?? [];
  });
}

function hasVisibleReadySlide(frame: GalleryFrame) {
  return frame.slides.some(
    (slide) =>
      slide.complete &&
      slide.naturalWidth > 0 &&
      slide.x < frame.right &&
      slide.x + slide.width > frame.left,
  );
}

function isIncomingSlideOnTop(frame: GalleryFrame) {
  const activeSlide = frame.slides.find(
    (slide) => slide.index === frame.activeIndex,
  );

  return Boolean(
    activeSlide &&
      frame.slides.every(
        (slide) =>
          slide.index === activeSlide.index || activeSlide.zIndex > slide.zIndex,
      ),
  );
}

function largestActiveSlideFrameDelta(frames: GalleryFrame[]) {
  return frames.slice(1).reduce((largestDelta, frame, frameIndex) => {
    const previousFrame = frames[frameIndex];
    const activeSlide = frame.slides.find(
      (slide) => slide.index === frame.activeIndex,
    );
    const previousActiveSlide = previousFrame.slides.find(
      (slide) => slide.index === frame.activeIndex,
    );

    if (activeSlide && previousActiveSlide) {
      largestDelta = Math.max(
        largestDelta,
        Math.abs(
          activeSlide.x - frame.left -
            (previousActiveSlide.x - previousFrame.left),
        ),
      );
    }

    return largestDelta;
  }, 0);
}

function entersFromExpectedSide(frames: GalleryFrame[], direction: -1 | 1) {
  return frames.some((frame) => {
    const activeSlide = frame.slides.find(
      (slide) => slide.index === frame.activeIndex,
    );

    if (!activeSlide) {
      return false;
    }

    const horizontalOffset = activeSlide.x - frame.left;
    const galleryWidth = frame.right - frame.left;

    return direction === 1
      ? horizontalOffset > galleryWidth * 0.2
      : horizontalOffset < -galleryWidth * 0.2;
  });
}

async function swipeGallery(
  page: Page,
  gallery: Locator,
  direction: -1 | 1,
) {
  const box = await gallery.boundingBox();
  const previousIndex = await gallery.getAttribute("data-studio-active-index");
  expect(box).not.toBeNull();
  expect(previousIndex).not.toBeNull();

  const activeSlide = gallery.locator(
    `.mat-studio-gallery__slide[data-studio-image-index="${previousIndex}"]`,
  );
  const initialSlideBox = await activeSlide.boundingBox();
  expect(initialSlideBox).not.toBeNull();

  await startGallerySampling(gallery);
  await page.mouse.move(
    box!.x + box!.width * (direction === 1 ? 0.75 : 0.25),
    box!.y + box!.height / 2,
  );
  await page.mouse.down();
  try {
    await page.mouse.move(
      box!.x + box!.width * (direction === 1 ? 0.25 : 0.75),
      box!.y + box!.height / 2,
      { steps: 6 },
    );
    if (direction === 1) {
      await expect
        .poll(async () => (await activeSlide.boundingBox())?.x ?? 0)
        .toBeLessThan(initialSlideBox!.x - 8);
    } else {
      await expect
        .poll(async () => (await activeSlide.boundingBox())?.x ?? 0)
        .toBeGreaterThan(initialSlideBox!.x + 8);
    }
  } finally {
    await page.mouse.up();
  }

  await expect
    .poll(() => gallery.getAttribute("data-studio-active-index"))
    .not.toBe(previousIndex);
  await expect(gallery).toHaveAttribute("data-studio-animating", "false");

  const frames = await stopGallerySampling(gallery);
  const transitionFrames = frames.filter((frame) => frame.animating);
  const transitionAndSettledFrames = frames.filter(
    (frame, index) => frame.animating || frames[index - 1]?.animating,
  );

  expect(transitionFrames.length).toBeGreaterThan(1);
  expect(transitionFrames.every(hasVisibleReadySlide)).toBe(true);
  expect(transitionFrames.every(isIncomingSlideOnTop)).toBe(true);
  expect(entersFromExpectedSide(transitionFrames, direction)).toBe(true);

  return {
    galleryWidth: box!.width,
    largestFrameDelta: largestActiveSlideFrameDelta(transitionAndSettledFrames),
  };
}

async function expectAutomaticLeftwardTransition(
  gallery: Locator,
  outgoingIndex: number,
  expectedIndex: number,
) {
  await startGallerySampling(gallery);

  try {
    await expect
      .poll(
        () =>
          gallery.evaluate((element, imageIndex) => {
            if (element.dataset.studioAnimating !== "true") {
              return 0;
            }

            const outgoingSlide = element.querySelector<HTMLElement>(
              `.mat-studio-gallery__slide[data-studio-image-index="${imageIndex}"]`,
            );

            if (!outgoingSlide) {
              return 0;
            }

            return (
              outgoingSlide.getBoundingClientRect().x -
              element.getBoundingClientRect().x
            );
          }, outgoingIndex),
        { intervals: [50], timeout: 7_000 },
      )
      .toBeLessThan(-8);

    await expect(gallery).toHaveAttribute("data-studio-animating", "false");
    await expect(gallery).toHaveAttribute(
      "data-studio-active-index",
      String(expectedIndex),
    );
    await gallery.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );

    const frames = await stopGallerySampling(gallery);
    let lastAnimatingFrame = -1;

    frames.forEach((frame, index) => {
      if (frame.animating) {
        lastAnimatingFrame = index;
      }
    });

    expect(lastAnimatingFrame).toBeGreaterThan(-1);
    const parkedFrames = frames.slice(lastAnimatingFrame + 1);
    expect(parkedFrames.length).toBeGreaterThan(1);

    const parkedOffsets = parkedFrames.map((frame) => {
      const parkedSlide = frame.slides.find(
        (slide) => slide.index === String(outgoingIndex),
      );

      expect(parkedSlide).toBeDefined();
      return {
        offset: parkedSlide!.x - frame.left,
        width: frame.right - frame.left,
      };
    });
    const activeOffsets = parkedFrames.map((frame) => {
      const activeSlide = frame.slides.find(
        (slide) => slide.index === String(expectedIndex),
      );

      expect(activeSlide).toBeDefined();
      return activeSlide!.x - frame.left;
    });

    expect(
      parkedOffsets.every(
        ({ offset, width }) =>
          offset <= width * -0.9 || offset >= width * 0.9,
      ),
    ).toBe(true);
    expect(
      parkedOffsets.some(({ offset, width }) => Math.abs(offset - width) <= 2),
    ).toBe(true);
    expect(activeOffsets.every((offset) => Math.abs(offset) <= 2)).toBe(true);
  } catch (error) {
    await stopGallerySampling(gallery);
    throw error;
  }
}

async function expectGalleryImagesReady(gallery: Locator) {
  await expect
    .poll(() =>
      gallery.locator(".mat-studio-gallery__slide img").evaluateAll((images) =>
        images.every(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
}

test("gallery starts paused for reduced motion and remains keyboard operable", { tag: "@cross-browser" }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const gallery = page.getByRole("button", { name: /galería del estudio/i });
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
  await gallery.click();
  await expect(gallery).toHaveAttribute("aria-pressed", "false");
  await gallery.press(" ");
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
});

test("gallery supports swipe navigation without changing its pause state", { tag: "@cross-browser" }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);

  const gallery = page.getByRole("button", { name: /galería del estudio/i });
  const activeSlide = gallery.locator(
    '.mat-studio-gallery__slide[data-studio-image-index="0"]',
  );
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute("data-studio-active-index", "0");
  await expect(gallery).toHaveAttribute("aria-pressed", "true");

  const box = await gallery.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height / 2, { steps: 6 });
    await expect
      .poll(async () => (await activeSlide.boundingBox())?.x ?? 0)
      .toBeLessThan(box!.x - 8);
  } finally {
    await page.mouse.up();
  }

  await expect(gallery).toHaveAttribute("data-studio-active-index", "1");
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
});

test("gallery keeps a loaded slide visible without a jump on mobile and desktop", { tag: "@cross-browser" }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });

  for (const viewport of [
    { height: 844, width: 390 },
    { height: 720, width: 1280 },
  ]) {
    await page.setViewportSize(viewport);
    await openLanding(page);

    const gallery = page.getByRole("button", { name: /galería del estudio/i });
    await gallery.scrollIntoViewIfNeeded();
    await gallery.click();
    await expect(gallery).toHaveAttribute("aria-pressed", "true");
    await expectGalleryImagesReady(gallery);

    for (const [direction, expectedIndex] of [
      [1, 1],
      [-1, 0],
      [1, 1],
      [-1, 0],
    ] as const) {
      const { galleryWidth, largestFrameDelta } = await swipeGallery(
        page,
        gallery,
        direction,
      );

      await expect(gallery).toHaveAttribute(
        "data-studio-active-index",
        String(expectedIndex),
      );
      expect(largestFrameDelta).toBeLessThan(galleryWidth * 0.9);
    }
  }
});

test("gallery auto rotation moves left and parks the previous slide without reversing", { tag: "@cross-browser" }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  const landingReady = openLanding(page);

  const gallery = page.getByRole("button", { name: /galería del estudio/i });
  await expect(gallery).toHaveAttribute("aria-pressed", "false");
  await gallery.click();
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
  await landingReady;

  await gallery.scrollIntoViewIfNeeded();
  await expectGalleryImagesReady(gallery);
  await expect(gallery).toHaveAttribute("data-studio-active-index", "0");

  await gallery.click();
  await expect(gallery).toHaveAttribute("aria-pressed", "false");

  await expectAutomaticLeftwardTransition(gallery, 0, 1);
  await expectAutomaticLeftwardTransition(gallery, 1, 0);
});
