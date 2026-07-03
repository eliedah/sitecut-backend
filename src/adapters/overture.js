// Overture Maps buildings & trees via DuckDB (public S3, no key). Requires duckdb in PATH.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { featureCollection, buildingFeature, pointFeature } from '../normalize.js';
const run = promisify(execFile);

const duckdbEnabled = () => process.env.ENABLE_DUCKDB !== '0';

async function extract(b, theme, type) {
  const out = path.join(os.tmpdir(), `ov_${Date.now()}.json`);
  await run('bash', ['scripts/overture_extract.sh', String(b.s), String(b.w), String(b.n), String(b.e), theme, type, out], {
    env: { ...process.env, OVERTURE_RELEASE: process.env.OVERTURE_RELEASE || '2025-01-22.0' }
  });
  const rows = JSON.parse(await fs.readFile(out, 'utf8'));
  await fs.unlink(out).catch(() => {});
  return rows;
}

export async function getOvertureBuildings(b) {
  if (!duckdbEnabled()) throw new Error('duckdb disabled');
  const rows = await extract(b, 'buildings', 'building');
  const feats = rows.map(r => {
    const g = JSON.parse(r.geom);
    const ring = (g.coordinates && g.coordinates[0]) || [];
    return buildingFeature(ring, { height: r.height ?? null, levels: r.levels ?? null, source: 'Overture Maps', id: r.id });
  }).filter(f => f.geometry.coordinates[0].length >= 3);
  return featureCollection(feats);
}

export async function getOvertureTrees(b) {
  if (!duckdbEnabled()) throw new Error('duckdb disabled');
  // Overture tree feature path can vary by release; adjust theme/type to the current schema.
  const rows = await extract(b, 'base', 'tree');
  const feats = rows.map(r => {
    const g = JSON.parse(r.geom);
    const [lon, lat] = g.coordinates;
    return pointFeature(lon, lat, { layer: 'tree', source: 'Overture Maps', id: r.id });
  });
  return featureCollection(feats);
}
