/**
 * Chroma-key magenta and export Valley degen enemy PNGs.
 * Session image map verified by visual QA (images 11–22).
 */
import sharp from 'sharp';
import path from 'path';
import { mkdir } from 'fs/promises';

const sessionImg =
  process.env.DEPTHS_IMG_DIR ||
  String.raw`C:\Users\geohi\.grok\sessions\C%3A%5CUsers%5Cgeohi\019ef93d-346f-7d30-9ad9-3fd975c5148c\images`;

const outDir = 'public/assets/enemies';

const MAP = [
  ['13.jpg', 'fudder.png'],
  ['12.jpg', 'jeeter.png'],
  ['14.jpg', 'non-believer.png'],
  ['11.jpg', 'scammer.png'],
  ['16.jpg', 'paper-hands.png'],
  ['18.jpg', 'ngmi.png'],
  ['15.jpg', 'boomer.png'],
  ['17.jpg', 'shill.png'],
  ['22.jpg', 'astrologer.png'],
  ['20.jpg', 'copium.png'],
  ['21.jpg', 'leverage.png'],
  ['19.jpg', 'airdrop.png'],
];

async function keyMagenta(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const isMagenta =
      r > 180 && b > 140 && g < 160 && r + b > g * 2.1 && Math.abs(r - b) < 120;
    const isNearWhitePink = r > 220 && g > 100 && g < 200 && b > 180 && g < r * 0.85;
    if (isMagenta || isNearWhitePink) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .trim({ threshold: 8 })
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 8 })
    .toFile(outputPath);
}

await mkdir(outDir, { recursive: true });

for (const [src, dest] of MAP) {
  const inPath = path.join(sessionImg, src);
  const outPath = path.join(outDir, dest);
  await keyMagenta(inPath, outPath);
  console.log('wrote', outPath);
}

console.log('done');
