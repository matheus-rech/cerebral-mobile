#!/usr/bin/env node
/**
 * Generate visual documentation of the neuroimaging segmentation output.
 * Calls the API directly, saves the overlay/comparison images, and creates
 * an HTML report that's rendered as a PNG for the docs.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const NEURO_URL = process.env.NEUROIMAGING_URL || 'http://localhost:5010';
const SAMPLE_USG = path.join(__dirname, '..', 'public', 'samples', 'sample_neurousg.jpg');
const SAMPLE_MRI = path.join(__dirname, '..', 'public', 'samples', 'brain_mri_sample.jpg');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

async function segment(endpoint, body) {
  const resp = await fetch(`${NEURO_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

function severityColor(sev) {
  return { critical: '#EF4444', urgent: '#F97316', significant: '#EAB308', routine: '#22C55E' }[sev] || '#6B7280';
}

function buildReportHtml(title, modality, result) {
  const findingsRows = result.findings.map(f => `
    <tr>
      <td><span class="dot" style="background:${severityColor(f.severity)}"></span>${f.structure}</td>
      <td><span class="badge" style="background:${severityColor(f.severity)}">${f.severity.toUpperCase()}</span></td>
      <td>${f.area_percentage.toFixed(2)}%</td>
      <td>${f.description}</td>
      <td>${f.recommendation}</td>
    </tr>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
         margin: 0; padding: 32px; background: #f8fafc; color: #0f172a; }
  h1 { margin: 0 0 4px; font-size: 28px; }
  .sub { color: #64748b; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .card { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .card h2 { margin: 0 0 12px; font-size: 16px; color: #475569; text-transform: uppercase; letter-spacing: .5px; }
  .card img { width: 100%; border-radius: 8px; display: block; }
  .summary { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat { background: white; border-radius: 10px; padding: 12px 18px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .stat .v { font-size: 24px; font-weight: 700; }
  .stat .l { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; }
  .stat.crit .v { color: #EF4444; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  th { text-align: left; padding: 12px 16px; background: #f1f5f9; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #475569; }
  td { padding: 12px 16px; border-top: 1px solid #e2e8f0; font-size: 14px; }
  td:first-child { font-weight: 600; text-transform: capitalize; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
  .badge { color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; letter-spacing: .5px; }
  .footer { margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center; }
</style></head><body>
  <h1>🧠 ${title}</h1>
  <div class="sub">Modality: <strong>${modality}</strong> · Request ID: <code>${result.metadata.request_id || 'n/a'}</code></div>
  <div class="summary">
    <div class="stat"><div class="v">${result.structures_found.length}</div><div class="l">Structures</div></div>
    <div class="stat ${result.critical_count > 0 ? 'crit' : ''}"><div class="v">${result.critical_count}</div><div class="l">Critical Findings</div></div>
    <div class="stat"><div class="v">${result.findings.length}</div><div class="l">Total Findings</div></div>
    <div class="stat"><div class="v">${(result.metadata.total_roi_area / 1000).toFixed(1)}k</div><div class="l">ROI Pixels</div></div>
  </div>
  <div class="grid">
    <div class="card"><h2>Original + Segmentation Comparison</h2><img src="data:image/png;base64,${result.comparison}"></div>
    <div class="card"><h2>Annotated Overlay</h2><img src="data:image/png;base64,${result.overlay}"></div>
  </div>
  <table>
    <thead><tr><th>Structure</th><th>Severity</th><th>Area %</th><th>Description</th><th>Recommendation</th></tr></thead>
    <tbody>${findingsRows}</tbody>
  </table>
  <div class="footer">CEREBRAL · Generated ${new Date().toISOString()}</div>
</body></html>`;
}

async function renderHtmlToPng(html, outPath) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1. NeuroUSG
  const usgImg = fs.readFileSync(SAMPLE_USG).toString('base64');
  console.log('Running NeuroUSG segmentation...');
  const usg = await segment('/segment/usg', { image: usgImg, structures: ['tumor', 'csf', 'parenchyma'] });
  console.log(`  ✓ ${usg.structures_found.length} structures, ${usg.critical_count} critical findings`);
  fs.writeFileSync(path.join(OUT_DIR, 'A1-neurousg-overlay.png'), Buffer.from(usg.overlay, 'base64'));
  fs.writeFileSync(path.join(OUT_DIR, 'A2-neurousg-comparison.png'), Buffer.from(usg.comparison, 'base64'));
  await renderHtmlToPng(buildReportHtml('NeuroUSG Segmentation Report', 'Brain Ultrasound', usg),
                       path.join(OUT_DIR, 'A3-neurousg-report.png'));
  console.log('  ✓ NeuroUSG report saved');

  // 2. MRI T1-Gd
  const mriImg = fs.readFileSync(SAMPLE_MRI).toString('base64');
  console.log('Running MRI T1-Gd segmentation...');
  const mri = await segment('/segment/mri', { image: mriImg, modality: 'T1_GD' });
  console.log(`  ✓ ${mri.structures_found.length} structures, ${mri.critical_count} critical findings`);
  fs.writeFileSync(path.join(OUT_DIR, 'B1-mri-t1gd-overlay.png'), Buffer.from(mri.overlay, 'base64'));
  fs.writeFileSync(path.join(OUT_DIR, 'B2-mri-t1gd-comparison.png'), Buffer.from(mri.comparison, 'base64'));
  await renderHtmlToPng(buildReportHtml('MRI T1-Gd Segmentation Report', 'T1 Post-Gadolinium', mri),
                       path.join(OUT_DIR, 'B3-mri-t1gd-report.png'));
  console.log('  ✓ MRI T1-Gd report saved');

  // 3. MRI FLAIR
  console.log('Running MRI FLAIR segmentation...');
  const flair = await segment('/segment/mri', { image: mriImg, modality: 'FLAIR' });
  console.log(`  ✓ ${flair.structures_found.length} structures, ${flair.critical_count} critical findings`);
  await renderHtmlToPng(buildReportHtml('MRI FLAIR Segmentation Report', 'FLAIR', flair),
                       path.join(OUT_DIR, 'C1-mri-flair-report.png'));
  console.log('  ✓ MRI FLAIR report saved');

  console.log('\nAll segmentation outputs captured');
}

run().catch(e => { console.error(e); process.exit(1); });
