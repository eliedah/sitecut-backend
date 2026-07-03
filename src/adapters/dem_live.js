// Live elevation providers (OpenTopoData + Open-Meteo). Same resilient logic as the app:
// retries, throttling, partial-failure tolerance with nearest-fill.
import { elevationGrid } from '../normalize.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const PROVIDERS = {
  ned10m:   { label: 'USGS NED 10 m (OpenTopoData)', res: 10, NX: 16, NY: 16, chunk: 100, conc: 1, spacing: 1100,
              url: (la, lo) => 'https://api.opentopodata.org/v1/ned10m?locations=' + la.map((v, i) => v + ',' + lo[i]).join('|'),
              parse: d => (d.results || []).map(r => r.elevation) },
  eudem25m: { label: 'EU-DEM 25 m (OpenTopoData)', res: 25, NX: 16, NY: 16, chunk: 100, conc: 1, spacing: 1100,
              url: (la, lo) => 'https://api.opentopodata.org/v1/eudem25m?locations=' + la.map((v, i) => v + ',' + lo[i]).join('|'),
              parse: d => (d.results || []).map(r => r.elevation) },
  aster30m: { label: 'ASTER GDEM 30 m (OpenTopoData)', res: 30, NX: 16, NY: 16, chunk: 100, conc: 1, spacing: 1100,
              url: (la, lo) => 'https://api.opentopodata.org/v1/aster30m?locations=' + la.map((v, i) => v + ',' + lo[i]).join('|'),
              parse: d => (d.results || []).map(r => r.elevation) },
  'open-meteo': { label: 'Copernicus GLO-90 (Open-Meteo)', res: 90, NX: 30, NY: 30, chunk: 100, conc: 3, spacing: 120,
              url: (la, lo) => 'https://api.open-meteo.com/v1/elevation?latitude=' + la.join(',') + '&longitude=' + lo.join(','),
              parse: d => d.elevation }
};

function nearestVal(out, i, j, NX, NY) {
  for (let r = 1; r < Math.max(NX, NY); r++)
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      const x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= NX || y >= NY) continue;
      const v = out[y * NX + x]; if (v != null) return v;
    }
  return 0;
}

export async function fetchLiveGrid(b, providerName) {
  const p = PROVIDERS[providerName]; if (!p) return null;
  const { NX, NY, chunk, conc, spacing } = p;
  const lats = [], lons = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    lats.push(+(b.s + (b.n - b.s) * j / (NY - 1)).toFixed(5));
    lons.push(+(b.w + (b.e - b.w) * i / (NX - 1)).toFixed(5));
  }
  const N = lats.length, starts = [];
  for (let s = 0; s < N; s += chunk) starts.push(s);
  const out = new Array(N).fill(null); let ok = 0;
  async function run(s) {
    const la = lats.slice(s, s + chunk), lo = lons.slice(s, s + chunk);
    for (let a = 0; a < 3; a++) {
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 18000);
        const r = await fetch(p.url(la, lo), { signal: ctrl.signal }); clearTimeout(to);
        if (r.status === 429) { await sleep(800 * (a + 1)); continue; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const e = p.parse(await r.json());
        if (!e || e.length !== la.length) throw new Error('bad data');
        for (let k = 0; k < e.length; k++) if (e[k] != null) { out[s + k] = e[k]; ok++; }
        return;
      } catch { await sleep(400 * (a + 1)); }
    }
  }
  for (let i = 0; i < starts.length; i += conc) {
    await Promise.all(starts.slice(i, i + conc).map(run));
    if (spacing && i + conc < starts.length) await sleep(spacing);
  }
  if (ok < N * 0.5) return null;
  const grid = [];
  for (let j = 0; j < NY; j++) { const row = []; for (let i = 0; i < NX; i++) { let v = out[j * NX + i]; if (v == null) v = nearestVal(out, i, j, NX, NY); row.push(v); } grid.push(row); }
  return elevationGrid({ source: p.label, res_m: p.res, bbox: { s: b.s, w: b.w, n: b.n, e: b.e }, NX, NY, grid });
}
