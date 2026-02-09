#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { preview } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

// Pages to pre-render for SEO
const pagesToPrerender = [
  { route: '/', output: 'index.html' },
  { route: '/weekly-digest', output: 'weekly-digest/index.html' },
];

async function prerender() {
  console.log('Starting prerender...');

  // Start a preview server (serves built files)
  const server = await preview({
    preview: { port: 4173 },
  });

  const port = 4173;
  console.log(`Preview server running on port ${port}`);

  const browser = await puppeteer.launch({
    headless: true,
  });

  // Use incognito context to ensure no stored auth state
  const context = await browser.createBrowserContext();

  try {
    const page = await context.newPage();

    for (const { route, output } of pagesToPrerender) {
      console.log(`\nPrerendering ${route}...`);

      // Clear any stored auth state before navigating (Supabase stores tokens in localStorage)
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          // Ignore errors if storage is not available
        }
      });

      // Navigate to the page
      await page.goto(`http://localhost:${port}${route}`, {
        waitUntil: 'networkidle0',
      });

      // Wait for the prerender-ready event or timeout
      console.log('Waiting for content to load...');
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.readyState === 'complete') {
            // Wait a bit for React to hydrate and fetch data
            setTimeout(resolve, 2000);
          } else {
            document.addEventListener('prerender-ready', resolve);
            // Fallback timeout
            setTimeout(resolve, 5000);
          }
        });
      });

      // Get the rendered HTML
      const html = await page.content();

      // Ensure the output directory exists
      const outputPath = path.join(distDir, output);
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Write the prerendered HTML
      await fs.writeFile(outputPath, html);
      console.log(`Prerendered ${route} saved to ${output}`);
    }

  } finally {
    await context.close();
    await browser.close();
    server.httpServer.close();
  }

  console.log('\nPrerender complete!');
}

prerender().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
