// OpenStreetMap via Overpass — buildings (with height/levels) and trees. Live, no key.
import { featureCollection, buildingFeature, pointFeature } from '../normalize.js';

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

async function overpass(query) {
  let lastErr;
  for (const url of MIRRORS) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 55000);
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), signal: ctrl.signal });
      clearTimeout(to);
      if (r.ok) return await r.json();
      lastErr = new Error('HTTP ' + r.status);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('overpass failed');
}

const heightFrom = t => {
  if (!t) return null;
  if (t.height) return parseFloat(t.height);
  if (t['building:levels']) return parseFloat(t['building:levels']) * 3.2;
  return null;
};

export async function getOSM(b) {
  const bbox = `${b.s},${b.w},${b.n},${b.e}`;
  const q = `[out:json][timeout:55];(
      way["building"](${bbox}); relation["building"](${bbox});
      node["natural"="tree"](${bbox});
    ); out body geom;`;
  const data = await overpass(q);
  const feats = [];
  for (const el of data.elements || []) {
    const t = el.tags || {};
    if (el.type === 'node' && t.natural === 'tree') {
      feats.push(pointFeature(el.lon, el.lat, { layer: 'tree', source: 'OpenStreetMap', id: 'node/' + el.id }));
    } else if (el.geometry && (t.building)) {
      const ring = el.geometry.map(p => [p.lon, p.lat]);
      if (ring.length >= 3) {
        if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) ring.push(ring[0]);
        feats.push(buildingFeature(ring, { height: heightFrom(t), levels: t['building:levels'] ? +t['building:levels'] : null, source: 'OpenStreetMap', id: el.type + '/' + el.id }));
      }
    }
  }
  return featureCollection(feats);
}
