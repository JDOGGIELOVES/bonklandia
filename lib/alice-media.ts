/**
 * Alice encounter media helpers — bandwidth-aware video decisions.
 */

/** Prefer still-only when the network is constrained. */
export function shouldPreferStillOverVideo(): boolean {
  if (typeof navigator === 'undefined') return false;
  try {
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (conn?.saveData) return true;
    const t = conn?.effectiveType;
    if (t === 'slow-2g' || t === '2g') return true;
  } catch {
    /* */
  }
  return false;
}
