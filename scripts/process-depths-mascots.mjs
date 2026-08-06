/**
 * Chroma-key magenta backgrounds and export Depths rival PNGs for the game.
 */
import sharp from 'sharp';
import { copyFile, mkdir } from 'fs/promises';
import path from 'path';

const sessionImg =
  process.env.DEPTHS_IMG_DIR ||
  String.raw`C:\Users\geohi\.grok\sessions\C%3A%5CUsers%5Cgeohi\019ef93d-346f-7d30-9ad9-3fd975c5148c\images`;

const outDir = 'public/assets/enemies';

/** Map session image index → final filename (verified by visual QA). */
const MAP = [
  ['1.jpg', 'dooge.png'],
  ['2.jpg', 'flokir.png'],
  ['3.jpg', 'pepe-unbothered.png'],
  ['4.jpg', 'hatdog.png'],
  ['5.jpg', 'mogger.png'],
  ['6.jpg', 'based-brett.png'],
  ['7.jpg', 'mewling.png'],
  ['8.jpg', 'popcatto.png'],
  ['9.jpg', 'giga-shiba.png'],
  ['10.jpg', 'copycat-council.png'],
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
    // Magenta / hot pink key (gen backgrounds vary slightly)
    const isMagenta =
      r > 180 && b > 140 && g < 160 && r + b > g * 2.1 && Math.abs(r - b) < 120;
    const isNearWhitePink = r > 220 && g > 100 && g < 200 && b > 180 && g < r * 0.85;
    if (isMagenta || isNearWhitePink) {
      data[i + 3] = 0;
    }
  }

  // Trim transparent edges, fit into 640 max side for web
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
  // Keep raw jpg backup for re-keying
  await copyFile(inPath, path.join(outDir, `raw-${dest.replace('.png', '.jpg')}`)).catch(() => {});
  console.log('wrote', outPath);
}

console.log('done');
