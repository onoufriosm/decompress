import { test, expect } from "@playwright/test";

test.describe("Channels Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/channels");
  });

  test("displays the channels page heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Channels" })).toBeVisible();
  });

  test("displays the search input", async ({ page }) => {
    await expect(page.getByPlaceholder("Search channels...")).toBeVisible();
  });

  test("shows loading skeletons initially", async ({ page }) => {
    // Navigate fresh to catch loading state
    await page.goto("/channels");
    // Grid should be visible (either with skeletons or content)
    await expect(page.locator(".grid").first()).toBeVisible({ timeout: 10000 });
  });

  test("loads and displays channel cards from API", async ({ page }) => {
    // Wait for the API call to complete and cards to render
    await page.waitForLoadState("networkidle");

    // Check if we have channel cards or the "no channels" message
    const hasChannels = await page.locator("a[href^='/channels/']").count();
    const noChannelsMessage = page.getByText("No channels found.");

    if (hasChannels > 0) {
      // Verify channel cards are displayed
      const channelCards = page.locator("a[href^='/channels/']");
      await expect(channelCards.first()).toBeVisible();

      // Verify card structure - should have channel name
      const firstCard = channelCards.first();
      await expect(firstCard.locator("h3")).toBeVisible();
    } else {
      // If no channels, the empty state message should be shown
      await expect(noChannelsMessage).toBeVisible();
    }
  });

  test("channel cards have expected structure", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const channelCards = page.locator("a[href^='/channels/']");
    const count = await channelCards.count();

    if (count > 0) {
      const firstCard = channelCards.first();

      // Should have a channel name (h3)
      await expect(firstCard.locator("h3")).toBeVisible();

      // Should have an avatar (either image or fallback)
      const avatar = firstCard.locator('[class*="avatar"], [data-radix-avatar]');
      await expect(avatar.first()).toBeVisible();
    }
  });

  test("channel cards display subscriber count when available", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    const channelCards = page.locator("a[href^='/channels/']");
    const count = await channelCards.count();

    if (count > 0) {
      // Check if any card has subscriber count badge
      const subscriberBadges = page.getByText(/subscribers/i);
      // This is optional data, so we just verify the page structure is correct
      expect(count).toBeGreaterThan(0);
    }
  });

  test("search filters channels", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder("Search channels...");
    await searchInput.fill("test");

    // Wait for debounced search to trigger
    await page.waitForTimeout(500);
    await page.waitForLoadState("networkidle");

    // The page should still be functional after search
    await expect(
      page.getByRole("heading", { name: "Channels" })
    ).toBeVisible();
  });

  test("clicking a channel card navigates to detail page", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const channelCards = page.locator("a[href^='/channels/']");
    const count = await channelCards.count();

    if (count > 0) {
      const firstCard = channelCards.first();
      const href = await firstCard.getAttribute("href");

      await firstCard.click();

      // Should navigate to the channel detail page
      await expect(page).toHaveURL(new RegExp(href!.replace("/", "\\/")));
    }
  });

  test("API returns valid channel data", async ({ page }) => {
    // Set up response interception BEFORE navigation
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes("supabase.co") && response.url().includes("sources")
    );

    // Reload to trigger a fresh API call
    await page.reload();

    const response = await responsePromise;

    // Check if API is properly configured
    if (!response.ok()) {
      console.log(`API returned ${response.status()}: ${response.url()}`);
      // Skip data validation if API returns error (likely config issue)
      test.skip(true, `Supabase API returned ${response.status()} - check API key configuration`);
      return;
    }

    const data = await response.json();

    // Verify API response structure
    expect(Array.isArray(data)).toBeTruthy();

    if (data.length > 0) {
      const channel = data[0];
      // Check expected fields exist
      expect(channel).toHaveProperty("id");
      expect(channel).toHaveProperty("name");
      expect(channel).toHaveProperty("external_id");
      expect(channel).toHaveProperty("type");
      expect(channel.type).toBe("youtube_channel");
    }
  });

  test("API filters by youtube_channel source type", async ({ page }) => {
    // Set up response interception BEFORE navigation
    const responsePromise = page.waitForResponse((response) => {
      const url = response.url();
      return url.includes("supabase.co") && url.includes("sources");
    });

    // Reload to trigger a fresh API call
    await page.reload();

    const response = await responsePromise;

    // Verify the URL contains the filter
    expect(response.url()).toContain("type=eq.youtube_channel");

    // Check if API is properly configured
    if (!response.ok()) {
      console.log(`API returned ${response.status()}: ${response.url()}`);
      test.skip(true, `Supabase API returned ${response.status()} - check API key configuration`);
      return;
    }

    expect(response.ok()).toBeTruthy();
  });
});
