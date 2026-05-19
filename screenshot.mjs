import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PUPPETEER_BASES = [
  process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData/Local/Temp/puppeteer-test') : null,
  'C:/Users/Mark Abe/AppData/Local/Temp/puppeteer-test',
  'C:/Users/nateh/AppData/Local/Temp/puppeteer-test',
].filter(Boolean);

async function loadPuppeteer() {
  for (const base of PUPPETEER_BASES) {
    const pkg = path.join(base, 'package.json');
    if (!fs.existsSync(pkg)) continue;
    try {
      const require = createRequire(pkg);
      return require('puppeteer');
    } catch {}
  }
  throw new Error('Could not load puppeteer from any configured path: ' + PUPPETEER_BASES.join(', '));
}

const url = process.argv[2];
const label = process.argv[3] || '';
const width = parseInt(process.argv[4], 10) || 1440;
const height = parseInt(process.argv[5], 10) || 900;

if (!url) {
  console.error('Usage: node screenshot.mjs <url> [label] [width] [height]');
  process.exit(1);
}

const outDir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Auto-increment filename
function nextFilename() {
  const existing = fs.readdirSync(outDir).filter(f => /^screenshot-\d+/.test(f));
  const nums = existing.map(f => parseInt(f.match(/^screenshot-(\d+)/)[1], 10));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  const suffix = label ? `-${label}` : '';
  return `screenshot-${n}${suffix}.png`;
}

const puppeteer = await loadPuppeteer();
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

const outPath = path.join(outDir, nextFilename());
await page.screenshot({ path: outPath, fullPage: true });
console.log(outPath);

await browser.close();
