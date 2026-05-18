#!/usr/bin/env node
/**
 * End-to-end test of the neuroimaging segmentation service against real
 * public-domain medical images downloaded from Wikimedia Commons.
 *
 * Generates:
 *   - Per-image segmentation overlay/comparison PNGs
 *   - Per-image HTML clinical report rendered to PNG
 *   - A summary "test gallery" HTML rendered to PNG
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const NEURO_URL = process.env.NEUROIMAGING_URL || 'http://localhost:5010';
const SAMPLES_DIR = path.join(__dirname, '..', 'public', 'samples', 'real');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'real-image-tests');

// Test cases: file → expected modality
const TEST_CASES = [
  {
    file: 'cranial_us_hemorrhage.jpg',
    endpoint: '/segment/usg',
    body: { structures: ['tumor', 'csf', 'parenchyma'] },
    label: 'Cranial Ultrasound — Germinal Matrix Hemorrhage',
    source: 'Wikimedia Commons (CC BY-SA 3.0)',
    expectedSeverity: 'has critical findings expected',
  },
  {
    file: 'glioblastoma_t1_contrast.jpg',
    endpoint: '/segment/mri',
    body: { modality: 'T1_GD' },
    label: 'MRI T1-Gd — Glioblastoma (Pediatric, 15yo)',
    source: 'Wikimedia Commons (CC BY-SA 3.0)',
    expectedSeverity: 'large tumor enhancement expected',
  },
  {
    file: 'brain_t1_axial.jpg',
    endpoint: '/segment/mri',
    body: { modality: 'T1_GD' },
    label: 'MRI T1 Axial — Glioblastoma Multiforme',
    source: 'Wikimedia Commons',
  },
  {
    file: 'brain_t1_contrast_axial.jpg',
    endpoint: '/segment/mri',
    body: { modality: 'T1_GD' },
    label: 'MRI T1+Contrast Axial — Glioblastoma Multiforme',
    source: 'Wikimedia Commons',
  },
  {
    file: 'brain_t2_axial.jpg',
    endpoint: '/segment/mri',
    body: { modality: 'T2' },
    label: 'MRI T2 Axial — Glioblastoma Multiforme',
    source: 'Wikimedia Commons',
  },
  {
    file: 'brain_glioma_063.jpg',
    endpoint: '/segment/mri',
    body: { modality: 'FLAIR' },
    label: 'MRI Glioma Case Slice 063',
    source: 'Wikimedia Commons',
  },
  {
    file: 'brain_glioma_070.jpg',
    endpoint: '/segment/mri',
    body: { modality: 'FLAIR' },
    label: 'MRI Glioma Case Slice 070',
    source: 'Wikimedia Commons',
  },
  {
    file: 'brain_glioma_080.jpg',
    endpoint: '/segment/mri',
    body: { modality: 'FLAIR' },
    label: 'MRI Glioma Case Slice 080',
    source: 'Wikimedia Commons',
  },
];

async function segment(endpoint, body) {
  const start = Date.now();
  const resp = await fetch(`${NEURO_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - start;
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  const json = await resp.json();
  json._elapsed_ms = elapsed;
  return json;
}

function severityColor(sev) {
  return { critical: '#EF4444', urgent: '#F97316', significant: '#EAB308', routine: '#22C55E' }[sev] || '#6B7280';
}

function reportHtml(testCase, result) {
  const findingsRows = result.findings.map(f => `
    <tr>
      <td><span class="dot" style="background:${severityColor(f.severity)}"></span><strong>${f.structure}</strong></td>
      <td><span class="badge" style="background:${severityColor(f.severity)}">${f.severity.toUpperCase()}</span></td>
      <td>${f.area_percentage.toFixed(2)}%</td>
      <td>${f.description}</td>
      <td>${f.recommendation}</td>
    </tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${testCase.label}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         margin: 0; padding: 32px; background: #f8fafc; color: #0f172a; }
  .header { margin-bottom: 20px; }
  h1 { margin: 0 0 6px; font-size: 24px; }
  .source { color: #64748b; font-size: 13px; }
  .meta { display: flex; gap: 16px; font-size: 12px; color: #64748b; margin-top: 8px; }
  .meta span code { background: #e2e8f0; padding: 2px 6px; border-radius: 3px; }
  .summary { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .stat { background: white; border-radius: 10px; padding: 10px 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .stat .v { font-size: 22px; font-weight: 700; }
  .stat .l { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; }
  .stat.crit .v { color: #EF4444; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .card { background: white; border-radius: 10px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .card h2 { margin: 0 0 10px; font-size: 13px; color: #475569; text-transform: uppercase; letter-spacing: .5px; }
  .card img { width: 100%; border-radius: 6px; display: block; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  th { text-align: left; padding: 10px 14px; background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #475569; }
  td { padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 13px; text-transform: capitalize; }
  td:nth-child(4), td:nth-child(5) { text-transform: none; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .badge { color: white; padding: 3px 9px; border-radius: 11px; font-size: 10px; font-weight: 700; letter-spacing: .5px; }
</style></head><body>
  <div class="header">
    <h1>${testCase.label}</h1>
    <div class="source">📷 ${testCase.source}</div>
    <div class="meta">
      <span>Modality: <code>${result.modality}</code></span>
      <span>Inference: <code>${result._elapsed_ms}ms</code></span>
      <span>Request ID: <code>${result.metadata.request_id || 'n/a'}</code></span>
    </div>
  </div>
  <div class="summary">
    <div class="stat"><div class="v">${result.structures_found.length}</div><div class="l">Structures</div></div>
    <div class="stat ${result.critical_count > 0 ? 'crit' : ''}"><div class="v">${result.critical_count}</div><div class="l">Critical</div></div>
    <div class="stat"><div class="v">${result.findings.length}</div><div class="l">Total Findings</div></div>
    <div class="stat"><div class="v">${(result.metadata.total_roi_area / 1000).toFixed(1)}k</div><div class="l">ROI Px</div></div>
  </div>
  <div class="grid">
    <div class="card"><h2>Original vs Segmentation</h2><img src="data:image/png;base64,${result.comparison}"></div>
    <div class="card"><h2>Annotated Overlay</h2><img src="data:image/png;base64,${result.overlay}"></div>
  </div>
  <table>
    <thead><tr><th>Structure</th><th>Severity</th><th>Area %</th><th>Description</th><th>Recommendation</th></tr></thead>
    <tbody>${findingsRows}</tbody>
  </table>
</body></html>`;
}

function galleryHtml(results) {
  const cards = results.map(r => {
    if (r.error) {
      return `<div class="case err">
        <h3>${r.testCase.label}</h3>
        <div class="source">${r.testCase.source}</div>
        <div class="error">❌ ${r.error}</div>
      </div>`;
    }
    return `<div class="case">
      <h3>${r.testCase.label}</h3>
      <div class="source">${r.testCase.source}</div>
      <img src="data:image/png;base64,${r.result.overlay}">
      <div class="metrics">
        <span class="m">📊 ${r.result.structures_found.length} structures</span>
        <span class="m ${r.result.critical_count > 0 ? 'crit' : ''}">${r.result.critical_count > 0 ? '🔴' : '🟢'} ${r.result.critical_count} critical</span>
        <span class="m">⏱ ${r.result._elapsed_ms}ms</span>
      </div>
    </div>`;
  }).join('');

  const totalCritical = results.reduce((s, r) => s + (r.result?.critical_count || 0), 0);
  const totalSucceeded = results.filter(r => !r.error).length;
  const avgTime = Math.round(results.filter(r => !r.error).reduce((s, r) => s + r.result._elapsed_ms, 0) / Math.max(totalSucceeded, 1));

  return `<!doctype html><html><head><meta charset="utf-8"><title>Real Image Test Gallery</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif;
         margin: 0; padding: 32px; background: #0f172a; color: #f8fafc; }
  h1 { margin: 0; font-size: 28px; }
  .subtitle { color: #94a3b8; margin: 4px 0 24px; }
  .stats { display: flex; gap: 14px; margin-bottom: 28px; flex-wrap: wrap; }
  .stat { background: #1e293b; border-radius: 10px; padding: 14px 20px; }
  .stat .v { font-size: 26px; font-weight: 700; }
  .stat.crit .v { color: #EF4444; }
  .stat.ok .v { color: #22C55E; }
  .stat .l { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .case { background: #1e293b; border-radius: 12px; padding: 16px; }
  .case h3 { margin: 0 0 4px; font-size: 14px; }
  .case .source { color: #94a3b8; font-size: 11px; margin-bottom: 12px; }
  .case img { width: 100%; border-radius: 8px; display: block; aspect-ratio: 16/10; object-fit: cover; }
  .metrics { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .m { font-size: 11px; background: #334155; padding: 4px 9px; border-radius: 14px; }
  .m.crit { background: #7f1d1d; color: #fecaca; }
  .err { background: #7f1d1d; }
  .error { color: #fecaca; font-size: 12px; margin-top: 12px; word-break: break-word; }
</style></head><body>
  <h1>🧠 CEREBRAL — Real-World Image Test Gallery</h1>
  <div class="subtitle">Live testing of the neuroimaging segmentation service against real public-domain medical images</div>
  <div class="stats">
    <div class="stat ok"><div class="v">${totalSucceeded}/${results.length}</div><div class="l">Succeeded</div></div>
    <div class="stat crit"><div class="v">${totalCritical}</div><div class="l">Critical Findings</div></div>
    <div class="stat"><div class="v">${avgTime}ms</div><div class="l">Avg Latency</div></div>
    <div class="stat"><div class="v">${results.length}</div><div class="l">Real Images Tested</div></div>
  </div>
  <div class="grid">${cards}</div>
</body></html>`;
}

async function renderHtmlToPng(html, outPath, viewport = { width: 1440, height: 1000, deviceScaleFactor: 2 }) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Testing ${TEST_CASES.length} real images against ${NEURO_URL}`);
  console.log('━'.repeat(70));

  const results = [];
  for (const tc of TEST_CASES) {
    const filepath = path.join(SAMPLES_DIR, tc.file);
    if (!fs.existsSync(filepath)) {
      console.log(`✗ ${tc.file} — file not found, skipping`);
      results.push({ testCase: tc, error: 'File not found' });
      continue;
    }
    process.stdout.write(`→ ${tc.file.padEnd(35)} `);
    try {
      const imgB64 = fs.readFileSync(filepath).toString('base64');
      const result = await segment(tc.endpoint, { ...tc.body, image: imgB64 });
      const slug = tc.file.replace(/\.[^.]+$/, '');
      fs.writeFileSync(path.join(OUT_DIR, `${slug}_overlay.png`), Buffer.from(result.overlay, 'base64'));
      fs.writeFileSync(path.join(OUT_DIR, `${slug}_comparison.png`), Buffer.from(result.comparison, 'base64'));
      await renderHtmlToPng(reportHtml(tc, result), path.join(OUT_DIR, `${slug}_report.png`));
      results.push({ testCase: tc, result });
      console.log(`✓ ${result.structures_found.length} structs, ${result.critical_count} crit, ${result._elapsed_ms}ms`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
      results.push({ testCase: tc, error: e.message });
    }
  }

  // Gallery summary
  console.log('━'.repeat(70));
  console.log('Rendering test gallery...');
  await renderHtmlToPng(galleryHtml(results), path.join(OUT_DIR, 'GALLERY.png'),
                        { width: 1600, height: 1200, deviceScaleFactor: 2 });

  // Markdown summary
  const md = `# Real-Image Test Results\n\nTested ${results.length} real public-domain medical images against the neuroimaging service.\n\n` +
    `![Gallery](./GALLERY.png)\n\n` +
    results.map(r => {
      if (r.error) return `### ❌ ${r.testCase.label}\n${r.testCase.source}\n\n\`\`\`\n${r.error}\n\`\`\`\n`;
      const slug = r.testCase.file.replace(/\.[^.]+$/, '');
      return `### ✅ ${r.testCase.label}\n${r.testCase.source}\n\n- **Modality:** ${r.result.modality}\n- **Structures found:** ${r.result.structures_found.length} (${r.result.structures_found.join(', ')})\n- **Critical findings:** ${r.result.critical_count}\n- **Inference time:** ${r.result._elapsed_ms}ms\n\n![Report](./${slug}_report.png)\n`;
    }).join('\n---\n\n');
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), md);

  const summary = results.reduce((s, r) => {
    if (r.error) s.failed++;
    else { s.succeeded++; s.totalCritical += r.result.critical_count; }
    return s;
  }, { succeeded: 0, failed: 0, totalCritical: 0 });

  console.log('━'.repeat(70));
  console.log(`Done: ${summary.succeeded} succeeded, ${summary.failed} failed, ${summary.totalCritical} total critical findings`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
