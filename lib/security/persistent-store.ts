import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let cachedDataDir: string | null = null;

/** In-memory fallback when the filesystem is read-only (Vercel serverless). */
const memoryStores = new Map<string, string>();

function isWritableDir(dir: string): boolean {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const probe = join(dir, '.write-probe');
    writeFileSync(probe, 'ok', 'utf8');
    return true;
  } catch {
    return false;
  }
}

function getDataDir(): string {
  if (cachedDataDir) return cachedDataDir;

  // Prefer /tmp on Vercel — deployment filesystem is EROFS.
  const candidates = [
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? join(tmpdir(), 'bonklandia-data')
      : null,
    join(tmpdir(), 'bonklandia-data'),
    join(process.cwd(), '.data'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (isWritableDir(dir)) {
      cachedDataDir = dir;
      return dir;
    }
  }

  // Last resort — still set tmp path; saves will no-op to memory.
  cachedDataDir = join(tmpdir(), 'bonklandia-data');
  return cachedDataDir;
}

function ensureDataDir(): void {
  const dir = getDataDir();
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
}

export function loadJsonStore<T>(filename: string, fallback: T): T {
  // Memory first (same warm instance)
  const mem = memoryStores.get(filename);
  if (mem) {
    try {
      return JSON.parse(mem) as T;
    } catch {
      // fall through
    }
  }

  try {
    ensureDataDir();
    const path = join(getDataDir(), filename);
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function saveJsonStore<T>(filename: string, data: T): void {
  const json = JSON.stringify(data, null, 2);
  memoryStores.set(filename, json);

  try {
    ensureDataDir();
    const path = join(getDataDir(), filename);
    writeFileSync(path, json, 'utf8');
  } catch {
    // EROFS / full disk — memory still holds it for this instance.
  }
}
