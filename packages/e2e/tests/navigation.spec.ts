import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("homepage redirects to videos", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/videos/);
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.goto("/videos");

    // Navigate to channels via sidebar
    await page.getByRole("link", { name: /channels/i }).click();
    await expect(page).toHaveURL(/\/channels/);
    await expect(
      page.getByRole("heading", { name: "Channels" })
    ).toBeVisible();

    // Navigate to AI chat via sidebar
    await page.getByRole("link", { name: /chat/i }).click();
    await expect(page).toHaveURL(/\/chat/);

    // Navigate back to videos
    await page.getByRole("link", { name: /videos/i }).click();
    await expect(page).toHaveURL(/\/videos/);
    await expect(page.getByRole("heading", { name: "Videos" })).toBeVisible();
  });

  test("all main pages are accessible", async ({ page }) => {
    // Videos page
    await page.goto("/videos");
    await expect(page).toHaveURL(/\/videos/);
    await expect(page.getByRole("heading", { name: "Videos" })).toBeVisible();

    // Channels page
    await page.goto("/channels");
    await expect(page).toHaveURL(/\/channels/);
    await expect(
      page.getByRole("heading", { name: "Channels" })
    ).toBeVisible();

    // Chat page
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/chat/);
  });

  test("video detail page is accessible", async ({ page }) => {
    await page.goto("/videos");
    await page.waitForLoadState("networkidle");

    const videoLinks = page.locator("a[href^='/videos/']");
    const count = await videoLinks.count();

    if (count > 0) {
      const firstLink = videoLinks.first();
      await firstLink.click();
      await expect(page).toHaveURL(/\/videos\/[a-f0-9-]+/);
    }
  });

  test("channel detail page is accessible", async ({ page }) => {
    await page.goto("/channels");
    await page.waitForLoadState("networkidle");

    const channelLinks = page.locator("a[href^='/channels/']");
    const count = await channelLinks.count();

    if (count > 0) {
      const firstLink = channelLinks.first();
      await firstLink.click();
      await expect(page).toHaveURL(/\/channels\/[a-f0-9-]+/);
    }
  });
});

test.describe("Layout", () => {
  test("sidebar is visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/videos");

    // Check for sidebar navigation elements - look for the sidebar links
    const videosLink = page.getByRole("link", { name: /videos/i });
    const channelsLink = page.getByRole("link", { name: /channels/i });

    await expect(videosLink).toBeVisible();
    await expect(channelsLink).toBeVisible();
  });

  test("page has proper document title", async ({ page }) => {
    await page.goto("/videos");
    // Page should have a title
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
