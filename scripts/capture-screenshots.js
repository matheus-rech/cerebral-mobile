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

const ROUTES = [
  { path: '/', name: '01-home' },
  { path: '/(tabs)/datasets', name: '02-datasets' },
  { path: '/(tabs)/history', name: '03-history' },
  { path: '/(tabs)/ml-settings', name: '04-ml-settings' },
  { path: '/analysis?imageUri=/public/samples/brain_mri_sample.jpg&model=neurousg', name: '05-analysis-neurousg' },
  { path: '/analysis?imageUri=/public/samples/brain_mri_sample.jpg&model=neuromri', name: '06-analysis-neuromri' },
  { path: '/analysis?imageUri=/public/samples/brain_mri_sample.jpg&model=unet', name: '07-analysis-unet' },
  { path: '/analysis?imageUri=/public/samples/brain_mri_sample.jpg&model=synthseg', name: '08-analysis-synthseg' },
  { path: '/interactive-segment?imageUri=/public/samples/brain_mri_sample.jpg&model=medsam2', name: '09-interactive-medsam2' },
  { path: '/model-comparison?imageUri=/public/samples/brain_mri_sample.jpg', name: '10-model-comparison' },
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
        // Let any client-side rendering/animation settle
        await new Promise(r => setTimeout(r, 1500));
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
