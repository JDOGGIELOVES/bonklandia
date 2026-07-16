import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHARACTERS_DIR = join(__dirname, '../public/assets/characters');
const THRESHOLD = 50;

function removeBackgroundFloodFill(png) {
  const { width: w, height: h, data } = png;
  const remove = new Uint8Array(w * h);

  function idx(x, y) {
    return y * w + x;
  }

  function isBackground(i) {
    const o = i * 4;
    const a = data[o + 3];
    if (a < 20) return true;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    return r <= THRESHOLD && g <= THRESHOLD && b <= THRESHOLD;
  }

  const queue = [];
  const lastX = w - 1;
  const lastY = h - 1;

  for (let x = 0; x < w; x++) {
    for (const y of [0, lastY]) {
      const i = idx(x, y);
      if (isBackground(i)) {
        remove[i] = 1;
        queue.push(i);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, lastX]) {
      const i = idx(x, y);
      if (!remove[i] && isBackground(i)) {
        remove[i] = 1;
        queue.push(i);
      }
    }
  }

  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i - x) / w;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny);
      if (remove[ni]) continue;
      if (isBackground(ni)) {
        remove[ni] = 1;
        queue.push(ni);
      }
    }
  }

  let cleared = 0;
  for (let i = 0; i < w * h; i++) {
    if (remove[i]) {
      const o = i * 4;
      if (data[o + 3] > 0) cleared++;
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 0;
    }
  }

  // Remove leftover black islands (gaps between legs, etc.)
  const ISLAND_THRESHOLD = 42;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (data[o + 3] < 20) continue;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    if (r <= ISLAND_THRESHOLD && g <= ISLAND_THRESHOLD && b <= ISLAND_THRESHOLD) {
      cleared++;
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 0;
    }
  }

  return cleared;
}

function processFile(filePath) {
  const buf = readFileSync(filePath);
  const png = PNG.sync.read(buf);
  const cleared = removeBackgroundFloodFill(png);
  writeFileSync(filePath, PNG.sync.write(png));
  return cleared;
}

const args = process.argv.slice(2);
const processAll = args.includes('--all');
const targets = processAll
  ? readdirSync(CHARACTERS_DIR)
      .filter(name => extname(name).toLowerCase() === '.png')
      .map(name => join(CHARACTERS_DIR, name))
  : [args.find(a => !a.startsWith('--')) ?? join(CHARACTERS_DIR, 'bongachill.png')];

for (const target of targets) {
  const cleared = processFile(target);
  console.log(`${target.split(/[/\\]/).pop()}: cleared ${cleared} background pixels`);
}