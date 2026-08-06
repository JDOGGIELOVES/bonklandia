/**
 * Chroma-key magenta champion portraits → public/assets/characters/*.png
 * Session map (images 23–28) verified by visual QA.
 */
import sharp from 'sharp';
import path from 'path';
import { mkdir, copyFile } from 'fs/promises';

const sessionImg =
  process.env.DEPTHS_IMG_DIR ||
  String.raw`C:\Users\geohi\.grok\sessions\C%3A%5CUsers%5Cgeohi\019ef93d-346f-7d30-9ad9-3fd975c5148c\images`;

const outDir = 'public/assets/characters';

const MAP = [
  ['25.jpg', 'bonk.png'],
  ['23.jpg', 'bonga.png'],
  ['26.jpg', 'bong.png'],
  ['24.jpg', 'bink.png'],
  ['28.jpg', 'bonnie.png'],
  ['27.jpg', 'beng.png'],
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

  // Champions display tall — keep height up to 900
  await sharp(data, { raw: { width, height, channels } })
    .trim({ threshold: 8 })
    .resize(720, 960, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 8 })
    .toFile(outputPath);
}

await mkdir(outDir, { recursive: true });

for (const [src, dest] of MAP) {
  const inPath = path.join(sessionImg, src);
  const outPath = path.join(outDir, dest);
  // Keep a backup of prior art once
  const backup = path.join(outDir, `legacy-${dest}`);
  try {
    await copyFile(outPath, backup);
  } catch {
    /* no prior */
  }
  await keyMagenta(inPath, outPath);
  console.log('wrote', outPath);
}

console.log('done');
