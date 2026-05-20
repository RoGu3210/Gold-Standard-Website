import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUPPETEER_BASES = [
  process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData/Local/Temp/puppeteer-test') : null,
  'C:/Users/Mark Abe/AppData/Local/Temp/puppeteer-test',
].filter(Boolean);
async function loadPuppeteer() {
  for (const base of PUPPETEER_BASES) {
    const pkg = path.join(base, 'package.json');
    if (!fs.existsSync(pkg)) continue;
    try { const require = createRequire(pkg); return require('puppeteer'); } catch {}
  }
  throw new Error('puppeteer not found');
}

const url = process.argv[2] || 'http://localhost:3100/index.html';
const outDir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: '360', w: 360, h: 740 },
];

// Sections to inspect via anchor / selector
const sections = [
  { name: 'hero', selector: '.hero' },
  { name: 'showcase', selector: '.showcase' },
  { name: 'testpreview', selector: '.test-preview' },
  { name: 'features', selector: '#features' },
  { name: 'recipes', selector: '#recipes' },
  { name: 'pricing', selector: '#pricing' },
  { name: 'transform', selector: '.transform-band' },
  { name: 'docs', selector: '#docs' },
  { name: 'changelog', selector: '#changelog' },
  { name: 'footer', selector: 'footer' },
];

const puppeteer = await loadPuppeteer();
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const vp of viewports) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  // disable animations / shader for stability
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;} #shader-canvas{display:none!important;}' });

  for (const s of sections) {
    try {
      const el = await page.$(s.selector);
      if (!el) continue;
      // Scroll element into view at top
      await page.evaluate((sel) => {
        const e = document.querySelector(sel);
        if (!e) return;
        const rect = e.getBoundingClientRect();
        const y = rect.top + window.pageYOffset - 80; // account for sticky header
        window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      }, s.selector);
      await new Promise(r => setTimeout(r, 500));
      const out = path.join(outDir, `vp-${vp.name}-${s.name}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(out);
    } catch (e) {
      console.error('section fail', s.name, vp.name, e.message);
    }
  }

  // Test the open mobile menu (only for narrow widths)
  if (vp.w < 992) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#nav-toggle');
    await new Promise(r => setTimeout(r, 400));
    const out = path.join(outDir, `vp-${vp.name}-menu-open.png`);
    await page.screenshot({ path: out, fullPage: false });
    console.log(out);
  }

  await page.close();
}

await browser.close();
console.log('done');
