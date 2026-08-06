/**
 * Shareable Alice run card — canvas PNG for Web Share / download.
 * Never navigates the tab to a blob: URL (that caused ERR_FILE_NOT_FOUND).
 */

import { BRAND } from '@/lib/brand';

export type AliceSharePayload = {
  aliceCoins: number;
  layersCleared: number;
  totalLayers: number;
  spendableEarned: number | null;
  spendableEstimate: number;
  isNewBest?: boolean;
  banked?: boolean;
};

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function buildAliceShareText(p: AliceSharePayload): string {
  const bankLine =
    p.spendableEarned != null && p.spendableEarned > 0
      ? `Banked +${p.spendableEarned.toLocaleString()} spendable chips`
      : `~${p.spendableEstimate.toLocaleString()} chips if banked`;
  return [
    `I finished ${BRAND.aliceRoom} on ${BRAND.name}!`,
    `Layers ${p.layersCleared}/${p.totalLayers} · ${p.aliceCoins.toLocaleString()} Alice Coins`,
    bankLine,
    p.isNewBest ? 'New personal best on this device.' : '',
    `${BRAND.url}/alice`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Render a 1080×1350 story-style card. */
export async function renderAliceShareCard(p: AliceSharePayload): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a0533');
  bg.addColorStop(0.45, '#0f0618');
  bg.addColorStop(1, '#05010c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const orb = (x: number, y: number, r: number, c: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  orb(220, 280, 320, 'rgba(168, 85, 247, 0.35)');
  orb(880, 420, 280, 'rgba(244, 114, 182, 0.28)');
  orb(540, 1100, 360, 'rgba(103, 232, 249, 0.18)');

  ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
  ctx.lineWidth = 4;
  fillRoundRect(ctx, 48, 48, W - 96, H - 96, 36);
  ctx.stroke();

  ctx.fillStyle = 'rgba(167, 139, 250, 0.95)';
  ctx.font = '600 36px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText(BRAND.name.toUpperCase(), W / 2, 140);

  ctx.fillStyle = '#fce7f3';
  ctx.font = '700 72px Georgia, "Times New Roman", serif';
  ctx.fillText(BRAND.aliceRoom, W / 2, 230);

  ctx.fillStyle = 'rgba(196, 181, 253, 0.85)';
  ctx.font = '500 32px system-ui, sans-serif';
  ctx.fillText(BRAND.aliceRoomNav, W / 2, 285);

  ctx.strokeStyle = 'rgba(240, 171, 252, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(180, 330);
  ctx.lineTo(W - 180, 330);
  ctx.stroke();

  ctx.fillStyle = '#67e8f9';
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.fillText('VOYAGE COMPLETE', W / 2, 400);

  ctx.fillStyle = '#f0abfc';
  ctx.font = '800 96px system-ui, sans-serif';
  ctx.fillText(`${p.layersCleared}/${p.totalLayers}`, W / 2, 520);
  ctx.fillStyle = 'rgba(233, 213, 255, 0.8)';
  ctx.font = '500 30px system-ui, sans-serif';
  ctx.fillText('layers cleared', W / 2, 570);

  const cardY = 640;
  const cardH = 160;
  const gap = 28;
  const cardW = (W - 96 - 96 - gap) / 2;
  const drawCard = (x: number, label: string, value: string, accent: string) => {
    ctx.fillStyle = 'rgba(30, 10, 48, 0.85)';
    fillRoundRect(ctx, x, cardY, cardW, cardH, 20);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    fillRoundRect(ctx, x, cardY, cardW, cardH, 20);
    ctx.stroke();
    ctx.fillStyle = 'rgba(196, 181, 253, 0.75)';
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillText(label, x + cardW / 2, cardY + 52);
    ctx.fillStyle = '#fdf4ff';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText(value, x + cardW / 2, cardY + 112);
  };

  drawCard(96, 'ALICE COINS', p.aliceCoins.toLocaleString(), 'rgba(240, 171, 252, 0.55)');
  const chipVal =
    p.spendableEarned != null
      ? `+${p.spendableEarned.toLocaleString()}`
      : `~${p.spendableEstimate.toLocaleString()}`;
  drawCard(
    96 + cardW + gap,
    p.spendableEarned != null ? 'BANKED CHIPS' : 'CHIP EST.',
    chipVal,
    'rgba(103, 232, 249, 0.55)',
  );

  if (p.isNewBest) {
    ctx.fillStyle = 'rgba(253, 224, 71, 0.95)';
    ctx.font = '700 34px system-ui, sans-serif';
    ctx.fillText('★ NEW DEVICE BEST ★', W / 2, 880);
  } else if (p.banked) {
    ctx.fillStyle = 'rgba(110, 231, 183, 0.95)';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText('Banked to the server ledger', W / 2, 880);
  }

  ctx.fillStyle = 'rgba(233, 213, 255, 0.7)';
  ctx.font = '500 28px system-ui, sans-serif';
  ctx.fillText('Pull for coins. Pull for shield. Choose carefully.', W / 2, 980);

  ctx.fillStyle = '#f0abfc';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText(BRAND.url.replace(/^https?:\/\//, '') + '/alice', W / 2, 1120);

  ctx.fillStyle = 'rgba(167, 139, 250, 0.55)';
  ctx.font = '500 22px system-ui, sans-serif';
  ctx.fillText('Eat the Mushroom · Bonklandia', W / 2, 1185);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Could not export share card'));
      },
      'image/png',
      0.92,
    );
  });
}

export type AliceShareResult = {
  status: 'shared' | 'downloaded' | 'copied' | 'preview' | 'failed';
  /** Object URL for in-page preview — caller must revoke when done. */
  previewUrl?: string;
  message: string;
};

/**
 * Download without navigating the current tab.
 * Revokes the blob URL only after a long delay so the browser can finish reading it.
 */
function triggerBlobDownload(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  // Do NOT set target=_blank — that opens blob: in a new tab → ERR_FILE_NOT_FOUND when revoked
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Keep node briefly; revoke URL later (not immediately)
  window.setTimeout(() => {
    try {
      a.remove();
    } catch {
      /* */
    }
  }, 2000);
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* */
    }
  }, 120_000);
  return url;
}

/**
 * Prefer native share with image; fall back to download + in-page preview.
 * Never navigates the current page to a blob: URL.
 */
export async function shareAliceRun(p: AliceSharePayload): Promise<AliceShareResult> {
  const text = buildAliceShareText(p);
  try {
    const blob = await renderAliceShareCard(p);
    const filename = 'bonklandia-alice-voyage.png';
    const file = new File([blob], filename, { type: 'image/png' });
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    // 1) Native share with file (mobile)
    if (typeof nav.share === 'function') {
      const withFiles: ShareData = {
        title: `${BRAND.aliceRoom} · ${BRAND.name}`,
        text,
        files: [file],
      };
      let canFiles = false;
      try {
        canFiles = !nav.canShare || nav.canShare(withFiles);
      } catch {
        canFiles = false;
      }
      if (canFiles) {
        try {
          await nav.share(withFiles);
          return { status: 'shared', message: 'Shared — nice pull.' };
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return { status: 'failed', message: 'Share cancelled.' };
          }
          // fall through
        }
      }
      // 2) Text-only share (no navigation)
      try {
        await nav.share({
          title: `${BRAND.aliceRoom} · ${BRAND.name}`,
          text,
          url: `${BRAND.url}/alice`,
        });
        return { status: 'shared', message: 'Shared text — save the card image from the preview.' };
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return { status: 'failed', message: 'Share cancelled.' };
        }
      }
    }

    // 3) Download + preview (desktop / no Web Share)
    // Create a durable preview URL for the UI (separate from download)
    const previewUrl = URL.createObjectURL(blob);
    triggerBlobDownload(blob, filename);

    let copied = false;
    try {
      await navigator.clipboard?.writeText(text);
      copied = true;
    } catch {
      /* clipboard may be blocked */
    }

    return {
      status: copied ? 'copied' : 'preview',
      previewUrl,
      message: copied
        ? 'Card ready — image download started · share text copied. Long-press the preview to save if needed.'
        : 'Card ready — image download started. Long-press / right-click the preview to save.',
    };
  } catch {
    try {
      await navigator.clipboard?.writeText(text);
      return {
        status: 'copied',
        message: 'Could not build image — share text was copied instead.',
      };
    } catch {
      return {
        status: 'failed',
        message: 'Could not share. Copy this page URL: ' + BRAND.url + '/alice',
      };
    }
  }
}
