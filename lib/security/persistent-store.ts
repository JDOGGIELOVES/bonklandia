import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let cachedDataDir: string | null = null;

function getDataDir(): string {
  if (cachedDataDir) return cachedDataDir;

  const localDir = join(process.cwd(), '.data');
  try {
    if (!existsSync(localDir)) mkdirSync(localDir, { recursive: true });
    cachedDataDir = localDir;
    return localDir;
  } catch {
    const tmpDir = join(tmpdir(), 'bonklandia-data');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    cachedDataDir = tmpDir;
    return tmpDir;
  }
}

function ensureDataDir(): void {
  const dir = getDataDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadJsonStore<T>(filename: string, fallback: T): T {
  ensureDataDir();
  const path = join(getDataDir(), filename);
  if (!existsSync(path)) return fallback;

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function saveJsonStore<T>(filename: string, data: T): void {
  ensureDataDir();
  const path = join(getDataDir(), filename);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}