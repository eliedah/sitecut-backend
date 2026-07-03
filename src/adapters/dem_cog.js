// National DTM Cloud-Optimized GeoTIFFs clipped to a bbox via the GDAL CLI (scripts/dem_grid.sh).
// Returns the common elevation-grid schema. Requires gdal in PATH (ENABLE_GDAL=1).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const run = promisify(execFile);

// Map coverage → a remote COG (or WCS/STAC-resolved) URL usable by GDAL /vsicurl/.
// NOTE: fill these with the concrete asset URLs for your areas. Some (AHN4, swissALTI3D) require
// resolving the exact tile/COG for the bbox first (PDOK WCS, swisstopo STAC) — do that in resolveSrc().
const SOURCES = [
  { name: 'AHN4',        res: 0.5,  covers: [50.75, 3.35, 53.6, 7.25],  resolveSrc: null /* PDOK WCS → COG */ },
  { name: 'swissALTI3D', res: 0.5,  covers: [45.8, 5.9, 47.8, 10.5],    resolveSrc: null /* swisstopo STAC */ },
  { name: 'LGLN DGM1',   res: 1.0,  covers: [51.3, 6.6, 53.9, 11.6],    resolveSrc: null /* LGLN COG */ },
  { name: 'LGL-BW DGM025', res: 0.25, covers: [47.5, 7.5, 49.8, 10.5], resolveSrc: null /* BW WCS */ },
  { name: 'Denmark DHM', res: 0.4,  covers: [54.5, 8.0, 57.8, 12.7],    resolveSrc: null /* Dataforsyningen (token) */ }
];

const inCov = (b, c) => ((b.s + b.n) / 2) >= c[0] && ((b.s + b.n) / 2) <= c[2] && ((b.w + b.e) / 2) >= c[1] && ((b.w + b.e) / 2) <= c[3];

export function pickCogSource(b) {
  return SOURCES.find(s => inCov(b, s.covers)) || null;
}

// srcUrl must be a GDAL-readable path, e.g. /vsicurl/https://host/tile.tif
export async function fetchCogGrid(b, src, srcUrl, NX = 48, NY = 48) {
  const tmp = path.join(os.tmpdir(), 'sc_' + Date.now() + '.json');
  await run('bash', ['scripts/dem_grid.sh', String(b.s), String(b.w), String(b.n), String(b.e), String(NX), String(NY), srcUrl, tmp]);
  const g = JSON.parse(await fs.readFile(tmp, 'utf8'));
  await fs.unlink(tmp).catch(() => {});
  return { source: src.name, res_m: src.res, bbox: { s: b.s, w: b.w, n: b.n, e: b.e }, NX, NY, grid: g.grid };
}
