/**
 * Exclusive music bed ownership — no engine imports (cycle-safe).
 */

export type MusicBed = 'casino' | 'alice' | 'depths';

let activeMusicBed: 'none' | MusicBed = 'none';

export function getActiveMusicBed(): 'none' | MusicBed {
  return activeMusicBed;
}

export function setActiveMusicBed(bed: 'none' | MusicBed): void {
  activeMusicBed = bed;
}
