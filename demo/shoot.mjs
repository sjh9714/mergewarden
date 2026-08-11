#!/usr/bin/env node
/**
 * Frame shooter. Opens demo/movie.html headless, calls window.seek(t) per
 * frame and saves PNGs to demo/_frames. The scene exposes seek/DURATION/ready
 * and nothing else, so this file works for any scene that honors the contract.
 *
 *   CHROME=/path/to/chrome node demo/shoot.mjs
 *   FRAMES=90,150 node demo/shoot.mjs      # render only a slice
 *   MOVIE=demo/other.html node demo/shoot.mjs
 */
import { launch } from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '_frames');
const FPS = 30;
const movieFile = process.env.MOVIE ?? join(HERE, 'movie.html');

const candidates = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const exe = candidates.find((p) => existsSync(p));
if (!exe) {
  console.error('no chrome found, set CHROME=/path/to/chrome');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const browser = await launch({
  executablePath: exe,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(movieFile).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => window.ready);

const DURATION = await page.evaluate(() => window.DURATION);
const step = 1000 / FPS;
const total = Math.ceil(DURATION / step);
let [first, last] = (process.env.FRAMES ?? `0,${total}`).split(',').map(Number);
last = Math.min(last, total);

for (let i = first; i <= last; i++) {
  await page.evaluate((t) => window.seek(t), Math.min(i * step, DURATION));
  await page.screenshot({ path: join(OUT, `frame_${String(i).padStart(5, '0')}.png`) });
  if (i % 30 === 0) console.log(`frame ${i}/${last}`);
}
await browser.close();
console.log(`rendered ${last - first + 1} frames to ${OUT}`);
