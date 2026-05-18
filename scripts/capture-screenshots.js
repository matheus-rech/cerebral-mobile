#!/usr/bin/env node
/**
 * Capture screenshots of CEREBRAL UI screens for documentation.
 * Captures both mobile (iPhone) and desktop viewports.
 */

const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8081';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
};

// Use a real glioblastoma MRI from Wikimedia Commons as the test image.
// Served by Expo from /public/ at the root path (/samples/..., not /public/samples/...).
const REAL_MRI = encodeURIComponent('http://localhost:8081/samples/real/glioblastoma_t1_contrast.jpg');
const REAL_USG = encodeURIComponent('http://localhost:8081/samples/real/cranial_us_hemorrhage.jpg');

const ROUTES = [
  { path: '/', name: '01-home' },
  { path: '/datasets', name: '02-datasets' },
  { path: '/history', name: '03-history' },
  { path: '/ml-settings', name: '04-ml-settings' },
  { path: `/analysis?imageUri=${REAL_USG}&model=neurousg`, name: '05-analysis-neurousg' },
  { path: `/analysis?imageUri=${REAL_MRI}&model=neuromri`, name: '06-analysis-neuromri' },
  { path: `/analysis?imageUri=${REAL_MRI}&model=unet`, name: '07-analysis-unet' },
  { path: `/analysis?imageUri=${REAL_MRI}&model=synthseg`, name: '08-analysis-synthseg' },
  { path: `/interactive-segment?imageUri=${REAL_MRI}&model=medsam2`, name: '09-interactive-medsam2' },
  { path: `/model-comparison?imageUri=${REAL_MRI}`, name: '10-model-comparison' },
];

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  console.log(`Capturing screenshots to ${OUT_DIR}`);
  let success = 0;
  let failed = 0;

  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    for (const route of ROUTES) {
      const page = await browser.newPage();
      await page.setViewport(viewport);

      const url = `${BASE_URL}${route.path}`;
      const filename = `${route.name}-${vpName}.png`;
      const filepath = path.join(OUT_DIR, filename);

      try {
        console.log(`  → ${vpName.padEnd(8)} ${route.name}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        // Wait for Expo Router client-side hydration to replace the SSR fallback
        await page.waitForFunction(
          () => !document.body.innerText.includes('Unmatched Route') &&
                !document.body.innerText.includes('Page could not be found'),
          { timeout: 10000 }
        ).catch(() => {/* keep going even if it never resolves */});
        // Let any client-side rendering/animation settle
        await new Promise(r => setTimeout(r, 2500));
        await page.screenshot({ path: filepath, fullPage: true });
        success++;
      } catch (err) {
        console.error(`    ✗ ${err.message.slice(0, 100)}`);
        failed++;
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
  console.log(`\nDone: ${success} captured, ${failed} failed`);
}

capture().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
