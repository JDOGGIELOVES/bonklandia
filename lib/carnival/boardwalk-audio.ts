/**
 * Boardwalk carnival wheel SFX — metal nail + red flapper ticks.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export async function unlockBoardwalkAudio(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === 'suspended') await c.resume();
    unlocked = true;
  } catch {
    unlocked = false;
  }
}

/**
 * Authentic flapper-on-nail click:
 * short noise burst (metal) + pitched ping that drops (plastic/wood pointer).
 */
export function playPegTick(intensity = 0.55): void {
  if (!unlocked) return;
  const c = getCtx();
  if (!c || c.state !== 'running') return;

  const t0 = c.currentTime;
  const i = Math.min(1, Math.max(0.15, intensity));

  // --- Layer 1: metal nail strike (noise through bandpass) ---
  const noiseLen = 0.045;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * noiseLen), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let n = 0; n < data.length; n++) {
    // decaying noise
    data[n] = (Math.random() * 2 - 1) * (1 - n / data.length);
  }
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2800 + Math.random() * 1200, t0);
  bp.Q.value = 4.5 + Math.random() * 2;
  const ng = c.createGain();
  const nVol = 0.12 + i * 0.22;
  ng.gain.setValueAtTime(nVol, t0);
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
  noise.connect(bp);
  bp.connect(ng);
  ng.connect(c.destination);
  noise.start(t0);
  noise.stop(t0 + noiseLen);

  // --- Layer 2: red flapper "tick" (pitched triangle snap) ---
  const osc = c.createOscillator();
  const og = c.createGain();
  osc.type = 'triangle';
  const f0 = 1400 + Math.random() * 500 + i * 200;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(180 + Math.random() * 80, t0 + 0.055);
  og.gain.setValueAtTime(0.1 + i * 0.16, t0);
  og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
  osc.connect(og);
  og.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.07);

  // --- Layer 3: body resonance (wood rim) ---
  const body = c.createOscillator();
  const bg = c.createGain();
  body.type = 'sine';
  body.frequency.setValueAtTime(90 + Math.random() * 40, t0);
  bg.gain.setValueAtTime(0.04 + i * 0.05, t0);
  bg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
  body.connect(bg);
  bg.connect(c.destination);
  body.start(t0);
  body.stop(t0 + 0.09);
}

/** Wheel stop — final nail settle + wood. */
export function playWheelStop(): void {
  if (!unlocked) return;
  const c = getCtx();
  if (!c || c.state !== 'running') return;

  const t0 = c.currentTime;
  playPegTick(0.95);

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t0 + 0.02);
  osc.frequency.exponentialRampToValueAtTime(50, t0 + 0.28);
  gain.gain.setValueAtTime(0.22, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0 + 0.02);
  osc.stop(t0 + 0.32);
}

export function playDiceRoll(): void {
  if (!unlocked) return;
  const c = getCtx();
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime;
  for (let i = 0; i < 5; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = t0 + i * 0.045;
    osc.type = 'square';
    osc.frequency.setValueAtTime(300 + Math.random() * 400, t);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.045);
  }
}
