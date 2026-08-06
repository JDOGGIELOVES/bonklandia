/**
 * Re-download Fam coin logos from Jupiter / fallback gateways into public/assets/logos.
 */
import sharp from 'sharp';
import { mkdir } from 'fs/promises';

const ICONS = {
  bonk: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  bonga: 'https://bafkreihfrextjqtpc7ucmz64qt23uoivldsy3tcidwl6ofkq7le2dlag7y.ipfs.nftstorage.link',
  bong: 'https://bafybeibo7rltr5o5xnuy3czioeamuzcfk5l4a5o5b65l74kaquygcjtdaa.ipfs.nftstorage.link',
  bink: 'https://pbs.twimg.com/profile_images/1745305637503053824/PX40zmAD_400x400.jpg',
  bonnie: 'https://arweave.net/wcpoNRzSAMup5Vc1F3zHZBfhHqNoCAFWqYkzOAli9RE',
  beng:
    'https://cdn.dexscreener.com/cms/images/e4f58ffc1dcaf69f154723a3a2e9a017a399fb763c0f0ea8648f30f23f0eb0cb?width=800&height=800&quality=95&format=auto',
};

function gateways(url) {
  const list = [url];
  const m = url.match(/bafk[a-z0-9]+|bafy[a-z0-9]+/i);
  if (m) {
    list.push(`https://nftstorage.link/ipfs/${m[0]}`);
    list.push(`https://ipfs.io/ipfs/${m[0]}`);
  }
  return [...new Set(list)];
}

async function pull(id, url) {
  let last;
  for (const u of gateways(url)) {
    try {
      const r = await fetch(u, {
        signal: AbortSignal.timeout(20000),
        headers: { 'User-Agent': 'BonklandiaLogoFetch/1.0' },
      });
      if (!r.ok) throw new Error(String(r.status));
      const buf = Buffer.from(await r.arrayBuffer());
      await sharp(buf)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(`public/assets/logos/${id}.png`);
      console.log('OK', id);
      return;
    } catch (e) {
      last = e;
      console.log('fail', id, u.slice(0, 50), e.message);
    }
  }
  throw last;
}

await mkdir('public/assets/logos', { recursive: true });
for (const [id, url] of Object.entries(ICONS)) {
  await pull(id, url);
}
console.log('done');
