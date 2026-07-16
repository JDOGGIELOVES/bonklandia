import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), '.data');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadJsonStore<T>(filename: string, fallback: T): T {
  ensureDataDir();
  const path = join(DATA_DIR, filename);
  if (!existsSync(path)) return fallback;

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function saveJsonStore<T>(filename: string, data: T): void {
  ensureDataDir();
  const path = join(DATA_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}