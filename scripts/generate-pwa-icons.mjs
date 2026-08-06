import sharp from 'sharp';
import { mkdir } from 'fs/promises';

const src = 'public/assets/characters/bonk.png';

async function makeIcon(size, out, { maskable = false } = {}) {
  const pad = maskable ? Math.round(size * 0.18) : Math.round(size * 0.08);
  const inner = size - pad * 2;
  const stroke = Math.max(2, Math.round(size / 64));
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0c0618"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#1a0b2e" stroke="#c084fc" stroke-width="${stroke}"/>
    </svg>`,
  );
  const img = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp(circle)
    .composite([{ input: img, left: pad, top: pad }])
    .png()
    .toFile(out);
  console.log('wrote', out);
}

await mkdir('public/icons', { recursive: true });
await makeIcon(192, 'public/icons/icon-192.png');
await makeIcon(512, 'public/icons/icon-512.png');
await makeIcon(512, 'public/icons/icon-512-maskable.png', { maskable: true });
await makeIcon(180, 'public/icons/apple-touch-icon.png');
await sharp(src).resize(32, 32, { fit: 'cover' }).png().toFile('public/icons/favicon-32.png');
console.log('PWA icons ready');
