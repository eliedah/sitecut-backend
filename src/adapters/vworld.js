// VWorld (Korea) Data API → building footprints as GeoJSON. Needs VWORLD_KEY + registered
// VWORLD_DOMAIN, and must egress from a Korea IP. 3D is restricted; this returns 2D footprints.
import { featureCollection, buildingFeature } from '../normalize.js';

const DATA = 'https://api.vworld.kr/req/data';

export async function getVWorldBuildings(b) {
  const key = process.env.VWORLD_KEY, domain = process.env.VWORLD_DOMAIN;
  if (!key || !domain) throw new Error('VWorld key/domain not set');
  const params = new URLSearchParams({
    service: 'data', request: 'GetFeature', format: 'json', size: '1000', page: '1',
    data: 'LT_C_BUILDINFO',                 // building layer id (adjust to the layer you licence)
    geomFilter: `BOX(${b.w},${b.s},${b.e},${b.n})`,
    key, domain, crs: 'EPSG:4326'
  });
  const r = await fetch(`${DATA}?${params}`);
  if (!r.ok) throw new Error('VWorld HTTP ' + r.status);
  const d = await r.json();
  const fc = d?.response?.result?.featureCollection;
  const feats = (fc?.features || []).map(f => {
    const ring = f.geometry?.coordinates?.[0] || [];
    const h = parseFloat(f.properties?.height || f.properties?.HEIGHT || '') || null;
    return buildingFeature(ring, { height: h, source: 'VWorld', id: f.properties?.id || null });
  }).filter(f => f.geometry.coordinates[0].length >= 3);
  return featureCollection(feats);
}
