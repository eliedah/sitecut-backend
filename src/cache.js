// Minimal keyed disk cache (no external deps). Swap for Redis in production if you prefer.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIR = process.env.CACHE_DIR || './.cache';
const TTL_MS = (Number(process.env.CACHE_TTL_HOURS) || 168) * 3600 * 1000;

function keyToFile(parts) {
  const h = createHash('sha1').update(JSON.stringify(parts)).digest('hex');
  return path.join(DIR, h + '.json');
}

export async function cached(parts, producer) {
  await fs.mkdir(DIR, { recursive: true });
  const file = keyToFile(parts);
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < TTL_MS) {
      return { ...JSON.parse(await fs.readFile(file, 'utf8')), _cache: 'hit' };
    }
  } catch { /* miss */ }
  const value = await producer();
  try { await fs.writeFile(file, JSON.stringify(value)); } catch { /* ignore */ }
  return { ...value, _cache: 'miss' };
}
