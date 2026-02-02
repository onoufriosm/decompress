#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { preview } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

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

  try {
    const page = await browser.newPage();

    // Navigate to the landing page
    console.log('Navigating to landing page...');
    await page.goto(`http://localhost:${port}/`, {
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

    // Read the original index.html
    const indexPath = path.join(distDir, 'index.html');

    // Write the prerendered HTML
    await fs.writeFile(indexPath, html);
    console.log('Prerendered landing page saved to index.html');

  } finally {
    await browser.close();
    server.httpServer.close();
  }

  console.log('Prerender complete!');
}

prerender().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
