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

// Coverage → a COPC/EPT source resolver. USGS 3DEP (US) is the easiest free one.
// For a bbox we resolve the covering 3DEP resource; national COPC can be added the same way.
const inUS = (la, lo) =>
  (la >= 24.5 && la <= 49.5 && lo >= -125 && lo <= -66.5) ||
  (la >= 51 && la <= 71 && lo >= -170 && lo <= -129) ||
  (la >= 18.5 && la <= 22.5 && lo >= -160 && lo <= -154);

// Return a PDAL-readable source for the bbox, or null if we have none.
// USGS 3DEP EPT entwine index (public, no key). You can extend this map per region.
export function resolvePointSource(b) {
  const lat = (b.s + b.n) / 2, lon = (b.w + b.e) / 2;
  if (inUS(lat, lon)) {
    // The 3DEP EPT resources are per-project; the AWS "usgs-lidar-public" bucket exposes an
    // index. For a production build, look up the covering project for (lat,lon). As a robust
    // default we use OpenTopography's USGS 3DEP point-cloud API if OT_API_KEY is set.
    return { name: 'USGS 3DEP', kind: 'ept' };
  }
  return null;
}

export async function getPointCloud(b, maxPoints = 1500000) {
  if (!pdalEnabled()) return null;
  const src = resolvePointSource(b);
  if (!src) return null;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pc_'));
  const laz = path.join(tmpDir, 'clip.laz');
  const outJson = path.join(tmpDir, 'clip.json');
  try {
    // 1) clip + decimate to LAZ using the bbox (WGS84). scripts/pointcloud_clip.sh wraps PDAL.
    await run('bash', ['scripts/pointcloud_clip.sh', String(b.s), String(b.w), String(b.n), String(b.e), String(maxPoints), laz], {
      env: { ...process.env }, timeout: 5 * 60 * 1000
    });
    // 2) convert LAZ → local-metres JSON for the browser
    await run('bash', ['scripts/pointcloud_to_json.sh', laz, String(b.s), String(b.w), outJson], { timeout: 3 * 60 * 1000 });
    const data = JSON.parse(await fs.readFile(outJson, 'utf8'));
    data.lazPath = laz;              // kept so /api/pointcloud.laz can stream the raw file
    data._dir = tmpDir;
    return data;
  } catch (e) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return null;
  }
}

// Raw LAZ for download (returns the file path produced by the clip, or null).
export async function getPointCloudLAZ(b, maxPoints = 4000000) {
  if (!pdalEnabled()) return null;
  const src = resolvePointSource(b);
  if (!src) return null;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pcz_'));
  const laz = path.join(tmpDir, 'sitecut_scan.laz');
  try {
    await run('bash', ['scripts/pointcloud_clip.sh', String(b.s), String(b.w), String(b.n), String(b.e), String(maxPoints), laz], { timeout: 6 * 60 * 1000 });
    return laz;
  } catch { await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {}); return null; }
}
