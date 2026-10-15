import type { Page } from "@playwright/test";

/**
 * The fixtures' covers live on `media.example.test`, which does not resolve. Image requests
 * (through next/image or direct) are answered with a 1x1 PNG so pages render deterministically.
 */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export async function stubMedia(page: Page): Promise<void> {
  await page.route(/\/_next\/image\?|media\.example\.test/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
  );
}

/** Every Insights page the suites visit, with the fixtures' slugs. */
export const INSIGHTS_PAGES = [
  { name: "index", path: "/insights" },
  { name: "format", path: "/insights?format=engineering-note" },
  { name: "article", path: "/insights/example-post-1" },
  { name: "topic", path: "/insights/topics/example-topic" },
  { name: "author", path: "/insights/authors/example-author" },
  { name: "home", path: "/" },
] as const;
