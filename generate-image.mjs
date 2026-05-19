import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '.env');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const API_KEY = env.KIE_API_KEY;
if (!API_KEY) {
  console.error('KIE_API_KEY not found in .env');
  process.exit(1);
}

const prompt = process.argv.slice(2).join(' ') || 'a chimpanzee wearing a diaper';
console.log(`Prompt: ${prompt}`);

const createRes = await fetch('https://api.kie.ai/api/v1/flux/kontext/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt,
    enableTranslation: true,
    aspectRatio: '1:1',
    outputFormat: 'png',
    promptUpsampling: false,
    model: 'flux-kontext-pro',
    safetyTolerance: 2,
  }),
});

const createJson = await createRes.json();
console.log('Create response:', JSON.stringify(createJson, null, 2));

const taskId = createJson?.data?.taskId;
if (!taskId) {
  console.error('No taskId returned. Aborting.');
  process.exit(1);
}

console.log(`Task created: ${taskId}. Polling...`);

let imageUrl = null;
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const pollRes = await fetch(
    `https://api.kie.ai/api/v1/flux/kontext/record-info?taskId=${encodeURIComponent(taskId)}`,
    { headers: { 'Authorization': `Bearer ${API_KEY}` } }
  );
  const pollJson = await pollRes.json();
  const flag = pollJson?.data?.successFlag;
  process.stdout.write(`[${i + 1}] successFlag=${flag} `);
  if (flag === 1) {
    imageUrl = pollJson?.data?.response?.resultImageUrl;
    console.log('\nDone.');
    break;
  }
  if (flag === 2 || flag === 3) {
    console.error('\nGeneration failed:', JSON.stringify(pollJson, null, 2));
    process.exit(1);
  }
}

if (!imageUrl) {
  console.error('Timed out waiting for image.');
  process.exit(1);
}

console.log(`Image URL: ${imageUrl}`);

const imgRes = await fetch(imageUrl);
const buf = Buffer.from(await imgRes.arrayBuffer());
const outDir = path.join(__dirname, 'generated_images');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = path.join(outDir, `image-${stamp}.png`);
fs.writeFileSync(outPath, buf);
console.log(`Saved to: ${outPath}`);
