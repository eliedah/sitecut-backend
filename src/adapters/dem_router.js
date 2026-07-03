// Picks the best terrain source for a bbox and returns the common elevation-grid schema.
// Order: national COG (GDAL) → live regional (NED/EU-DEM) → ESRI (key) → live global (Open-Meteo/ASTER).
import { demChain } from '../resolver.js';
import { fetchLiveGrid } from './dem_live.js';
import { pickCogSource, fetchCogGrid } from './dem_cog.js';
import { fetchEsriGrid } from './esri_terrain.js';

const gdalEnabled = () => process.env.ENABLE_GDAL !== '0';

export async function getDEM(b) {
  const lat = (b.s + b.n) / 2, lon = (b.w + b.e) / 2;

  // 1) national high-res COG, if we have a resolvable source URL for this area
  if (gdalEnabled()) {
    const cog = pickCogSource(b);
    if (cog && cog.resolveSrc) {
      try {
        const url = await cog.resolveSrc(b);           // implement per-source (PDOK/STAC/WCS)
        if (url) return await fetchCogGrid(b, cog, url);
      } catch { /* fall through */ }
    }
  }

  // 2) live regional (NED 10 m in US, EU-DEM 25 m in Europe), then live global
  for (const prov of demChain(lat, lon)) {
    try { const g = await fetchLiveGrid(b, prov); if (g) return g; } catch { /* next */ }
  }

  // 3) ESRI global (key) as gap-filler
  try { const g = await fetchEsriGrid(b); if (g) return g; } catch { /* ignore */ }

  // 4) last resort: global live
  return (await fetchLiveGrid(b, 'aster30m')) || (await fetchLiveGrid(b, 'open-meteo'));
}
