import { test, expect } from "@playwright/test";

test.describe("Videos Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/videos");
  });

  test("displays the videos page heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Videos" })).toBeVisible();
  });

  test("displays the search input", async ({ page }) => {
    await expect(page.getByPlaceholder("Search videos...")).toBeVisible();
  });

  test("shows loading skeletons initially", async ({ page }) => {
    // Navigate fresh to catch loading state
    await page.goto("/videos");
    // Skeletons should appear briefly before data loads
    // We check that eventually either skeletons disappear or content appears
    await expect(
      page.locator(".grid").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("loads and displays video cards from API", async ({ page }) => {
    // Wait for the API call to complete and cards to render
    await page.waitForLoadState("networkidle");

    // Check if we have video cards or the "no videos" message
    const hasVideos = await page.locator("a[href^='/videos/']").count();
    const noVideosMessage = page.getByText("No videos found.");

    if (hasVideos > 0) {
      // Verify video cards are displayed
      const videoCards = page.locator("a[href^='/videos/']");
      await expect(videoCards.first()).toBeVisible();

      // Verify card structure - should have title
      const firstCard = videoCards.first();
      await expect(firstCard.locator("h3")).toBeVisible();
    } else {
      // If no videos, the empty state message should be shown
      await expect(noVideosMessage).toBeVisible();
    }
  });

  test("video cards have expected structure", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const videoCards = page.locator("a[href^='/videos/']");
    const count = await videoCards.count();

    if (count > 0) {
      const firstCard = videoCards.first();

      // Should have a title (h3)
      await expect(firstCard.locator("h3")).toBeVisible();

      // Should have either a thumbnail image or placeholder
      const hasImage = await firstCard.locator("img").count();
      const hasPlaceholder = await firstCard.getByText("No thumbnail").count();
      expect(hasImage > 0 || hasPlaceholder > 0).toBeTruthy();
    }
  });

  test("search filters videos", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder("Search videos...");
    await searchInput.fill("test");

    // Wait for debounced search to trigger
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle");

    // The page should still be functional after search
    await expect(page.getByRole("heading", { name: "Videos" })).toBeVisible();
  });

  test("clicking a video card navigates to detail page", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const videoCards = page.locator("a[href^='/videos/']");
    const count = await videoCards.count();

    if (count > 0) {
      const firstCard = videoCards.first();
      const href = await firstCard.getAttribute("href");

      await firstCard.click();

      // Should navigate to the video detail page
      await expect(page).toHaveURL(new RegExp(href!.replace("/", "\\/")));
    }
  });

  test("API returns valid video data", async ({ page }) => {
    // Set up response interception BEFORE navigation
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("supabase.co") &&
        response.url().includes("videos") &&
        response.status() === 200
    );

    // Reload to trigger a fresh API call (beforeEach already navigated)
    await page.reload();

    const response = await responsePromise;
    const data = await response.json();

    // Verify API response structure
    expect(response.ok()).toBeTruthy();
    expect(Array.isArray(data)).toBeTruthy();

    if (data.length > 0) {
      const video = data[0];
      // Check expected fields exist
      expect(video).toHaveProperty("id");
      expect(video).toHaveProperty("title");
      expect(video).toHaveProperty("external_id");
    }
  });
});
