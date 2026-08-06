/**
 * Boardwalk carnival wheel SFX — synthesized peg ticks + wood clack.
 * No audio assets required; unlocks on first user gesture.
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

/** Call from a click handler so browsers allow sound. */
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

/** Short metallic peg hit under the flapper. */
export function playPegTick(intensity = 0.55): void {
  if (!unlocked) return;
  const c = getCtx();
  if (!c || c.state !== 'running') return;

  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(880 + Math.random() * 220, t0);
  osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.04);

  filter.type = 'highpass';
  filter.frequency.value = 400;

  const vol = Math.min(0.35, 0.08 + intensity * 0.18);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.06);
}

/** Wooden wheel stop clack. */
export function playWheelStop(): void {
  if (!unlocked) return;
  const c = getCtx();
  if (!c || c.state !== 'running') return;

  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, t0);
  osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.18);
  gain.gain.setValueAtTime(0.28, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.25);

  // Second layer — soft wood thud
  const osc2 = c.createOscillator();
  const g2 = c.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(90, t0);
  g2.gain.setValueAtTime(0.06, t0);
  g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
  osc2.connect(g2);
  g2.connect(c.destination);
  osc2.start(t0);
  osc2.stop(t0 + 0.14);
}

/** Soft dice roll rattle. */
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
