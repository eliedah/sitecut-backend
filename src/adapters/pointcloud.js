// LiDAR point-cloud clip for a bbox. Reads a COPC/EPT source (USGS 3DEP etc.) with PDAL,
// crops to the site, decimates, and returns compact JSON {n, xyz[], rgb[]} in LOCAL metres
// (east/up/north relative to the bbox SW corner) so the frontend can drop it straight into Three.js.
// Requires PDAL in PATH (ENABLE_PDAL=1). Falls back to null (frontend shows "no LiDAR here").
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const run = promisify(execFile);

const pdalEnabled = () => process.env.ENABLE_PDAL === '1';
const inBox = (la, lo, s, w, n, e) => la >= s && la <= n && lo >= w && lo <= e;

// ---- Free LiDAR source catalog (point clouds) ----
// kind: 'opentopo' (OT API, US 3DEP), 'pc-stac' (Planetary Computer COPC, free/no key),
//       'copc'/'ept' (direct streamable URL via env), 'portal' (free download site, not auto-streamed)
const inUS = (la, lo) =>
  inBox(la, lo, 24.5, -125, 49.5, -66.5) || inBox(la, lo, 51, -170, 71, -129) || inBox(la, lo, 18.5, -160, 22.5, -154);

export const LIDAR_SOURCES = [
  { name: 'USGS 3DEP LiDAR', region: 'United States', access: 'live', covers: inUS,
    note: 'public domain · via Planetary Computer (no key) or OpenTopography' },
  { name: 'CanElevation LiDAR', region: 'Canada', access: 'portal', covers: (la, lo) => inBox(la, lo, 41, -141, 84, -52),
    note: 'NRCan open licence · COPC on AWS' },
  { name: 'AHN (Actueel Hoogtebestand)', region: 'Netherlands', access: 'portal', covers: (la, lo) => inBox(la, lo, 50.75, 3.35, 53.6, 7.25),
    note: 'free LAZ/COPC via GeoTiles/PDOK' },
  { name: 'swissSURFACE3D', region: 'Switzerland', access: 'portal', covers: (la, lo) => inBox(la, lo, 45.8, 5.9, 47.8, 10.5),
    note: 'swisstopo free LiDAR (STAC)' },
  { name: 'National LIDAR Programme', region: 'England', access: 'portal', covers: (la, lo) => inBox(la, lo, 49.9, -6.4, 55.8, 1.8),
    note: 'Environment Agency, Open Government Licence' },
  { name: 'PNOA-LiDAR', region: 'Spain', access: 'portal', covers: (la, lo) => inBox(la, lo, 36, -9.3, 43.8, 3.3),
    note: 'IGN, free CC-BY' },
  { name: 'NLS LiDAR', region: 'Finland', access: 'portal', covers: (la, lo) => inBox(la, lo, 59.5, 19, 70.1, 31.6),
    note: 'Maanmittauslaitos, CC BY 4.0' },
  { name: 'Maa-amet LiDAR', region: 'Estonia', access: 'portal', covers: (la, lo) => inBox(la, lo, 57.5, 21.7, 59.7, 28.2), note: 'free' },
  { name: 'ARSO LiDAR', region: 'Slovenia', access: 'portal', covers: (la, lo) => inBox(la, lo, 45.4, 13.3, 46.9, 16.6), note: 'public domain, full national cover' },
  { name: 'OpenTopography (global research sets)', region: 'Global (patchy)', access: 'key', covers: () => true,
    note: 'hundreds of airborne/terrestrial datasets; free API key' }
];

export function lidarSourcesFor(lat, lon) {
  return LIDAR_SOURCES.filter(s => s.covers(lat, lon)).map(({ covers, ...r }) => r);
}

// Resolve a PDAL-usable source (URL + reader kind) for the bbox, trying free options in order.
async function resolvePointSource(b) {
  const lat = (b.s + b.n) / 2, lon = (b.w + b.e) / 2;
  // 1) explicit override via env (any COPC/EPT url)
  if (process.env.SOURCE) return { url: process.env.SOURCE, kind: process.env.SOURCE.includes('ept.json') ? 'ept' : 'copc', name: 'custom' };
  // 2) OpenTopography (US 3DEP) if a key is set — handled directly in the clip script
  if (process.env.OT_API_KEY && inUS(lat, lon)) return { kind: 'opentopo', name: 'USGS 3DEP (OpenTopography)' };
  // 3) Microsoft Planetary Computer — free US 3DEP COPC, no key
  if (inUS(lat, lon)) {
    try {
      const r = await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collections: ['3dep-lidar-copc'], bbox: [b.w, b.s, b.e, b.n], limit: 1 })
      });
      const j = await r.json();
      const asset = j?.features?.[0]?.assets?.data || j?.features?.[0]?.assets?.copc;
      if (asset?.href) {
        // sign the asset (free, no account)
        const s = await fetch('https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=' + encodeURIComponent(asset.href));
        const sj = await s.json();
        return { url: sj.href || asset.href, kind: 'copc', name: 'USGS 3DEP (Planetary Computer)' };
      }
    } catch { /* fall through */ }
  }
  return null;
}

export async function getPointCloud(b, maxPoints = 1500000) {
  if (!pdalEnabled()) return null;
  const src = await resolvePointSource(b);
  if (!src) return null;
  const env = { ...process.env };
  if (src.url) { env.SOURCE = src.url; env.SRCKIND = src.kind; }
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pc_'));
  const laz = path.join(tmpDir, 'clip.laz');
  const outJson = path.join(tmpDir, 'clip.json');
  try {
    await run('bash', ['scripts/pointcloud_clip.sh', String(b.s), String(b.w), String(b.n), String(b.e), String(maxPoints), laz], { env, timeout: 5 * 60 * 1000 });
    await run('bash', ['scripts/pointcloud_to_json.sh', laz, String(b.s), String(b.w), outJson], { timeout: 3 * 60 * 1000 });
    const data = JSON.parse(await fs.readFile(outJson, 'utf8'));
    data.source = src.name;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return data;
  } catch (e) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return null;
  }
}

// Raw LAZ for download (returns the file path produced by the clip, or null).
export async function getPointCloudLAZ(b, maxPoints = 4000000) {
  if (!pdalEnabled()) return null;
  const src = await resolvePointSource(b);
  if (!src) return null;
  const env = { ...process.env };
  if (src.url) { env.SOURCE = src.url; env.SRCKIND = src.kind; }
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pcz_'));
  const laz = path.join(tmpDir, 'sitecut_scan.laz');
  try {
    await run('bash', ['scripts/pointcloud_clip.sh', String(b.s), String(b.w), String(b.n), String(b.e), String(maxPoints), laz], { env, timeout: 6 * 60 * 1000 });
    return laz;
  } catch { await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {}); return null; }
}
