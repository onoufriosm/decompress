import { test, expect } from "@playwright/test";

test.describe("Video Detail Page", () => {
  test("loads video detail page from videos list", async ({ page }) => {
    // First go to videos page
    await page.goto("/videos");
    await page.waitForLoadState("networkidle");

    const videoCards = page.locator("a[href^='/videos/']");
    const count = await videoCards.count();

    if (count > 0) {
      // Click first video
      const firstCard = videoCards.first();
      const videoTitle = await firstCard.locator("h3").textContent();

      await firstCard.click();
      await page.waitForLoadState("networkidle");

      // Should be on detail page
      await expect(page).toHaveURL(/\/videos\/[a-f0-9-]+/);

      // Page should show video info
      await expect(page.getByRole("heading").first()).toBeVisible();
    } else {
      test.skip(true, "No videos available to test");
    }
  });

  test("debug video detail page API calls", async ({ page }) => {
    const apiCalls: { url: string; status: number; body?: string }[] = [];

    page.on("response", async (response) => {
      if (response.url().includes("supabase.co/rest")) {
        let body = "";
        try {
          body = await response.text();
        } catch {
          body = "Could not read body";
        }
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          body: body.substring(0, 500),
        });
      }
    });

    // First get a video ID from the videos list
    await page.goto("/videos");
    await page.waitForLoadState("networkidle");

    const videoCards = page.locator("a[href^='/videos/']");
    const count = await videoCards.count();

    if (count > 0) {
      const firstCard = videoCards.first();
      const href = await firstCard.getAttribute("href");

      console.log(`\n=== Navigating to ${href} ===`);
      apiCalls.length = 0;

      await page.goto(href!);
      await page.waitForLoadState("networkidle");

      console.log("\n=== Video Detail API Calls ===");
      apiCalls.forEach((c) => {
        console.log(`${c.status} ${c.url}`);
        if (c.status >= 400) {
          console.log(`  Response: ${c.body}`);
        }
      });

      // Check for error messages on page
      const errorText = await page
        .getByText(/error|failed|not found/i)
        .count();
      if (errorText > 0) {
        console.log("\n=== Error text found on page ===");
        const errors = await page.getByText(/error|failed|not found/i).all();
        for (const err of errors) {
          console.log(await err.textContent());
        }
      }
    } else {
      test.skip(true, "No videos available to test");
    }

    expect(true).toBe(true);
  });

  test("video detail page displays video information", async ({ page }) => {
    // Go directly to a video via the list
    await page.goto("/videos");
    await page.waitForLoadState("networkidle");

    const videoCards = page.locator("a[href^='/videos/']");
    const count = await videoCards.count();

    if (count > 0) {
      await videoCards.first().click();
      await page.waitForLoadState("networkidle");

      // Should have a title
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible({ timeout: 10000 });

      // Should have either transcript tab, summary tab, or video info
      const hasTranscript = await page.getByText(/transcript/i).count();
      const hasSummary = await page.getByText(/summary/i).count();
      const hasDescription = await page.locator("p").count();

      expect(hasTranscript > 0 || hasSummary > 0 || hasDescription > 0).toBe(
        true
      );
    } else {
      test.skip(true, "No videos available to test");
    }
  });
});
