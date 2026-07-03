// ESRI Terrain 3D — global elevation from the ArcGIS WorldElevation3D/Terrain3D ImageServer.
// Needs ARCGIS_API_KEY. Used as the global gap-filler for areas without an open DTM.
import { elevationGrid } from '../normalize.js';

const ENDPOINT = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer/getSamples';

export async function fetchEsriGrid(b, NX = 24, NY = 24) {
  const key = process.env.ARCGIS_API_KEY;
  if (!key) return null;
  const pts = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++)
    pts.push([b.w + (b.e - b.w) * i / (NX - 1), b.s + (b.n - b.s) * j / (NY - 1)]);
  const geometry = { points: pts, spatialReference: { wkid: 4326 } };
  const body = new URLSearchParams({
    geometry: JSON.stringify(geometry), geometryType: 'esriGeometryMultipoint',
    returnFirstValueOnly: 'true', f: 'json', token: key
  });
  const r = await fetch(ENDPOINT, { method: 'POST', body });
  if (!r.ok) return null;
  const d = await r.json();
  const vals = (d.samples || []).map(s => parseFloat(s.value));
  if (vals.length !== NX * NY) return null;
  const grid = [];
  for (let j = 0; j < NY; j++) grid.push(vals.slice(j * NX, (j + 1) * NX));
  return elevationGrid({ source: 'ESRI Terrain 3D', res_m: 2, bbox: { s: b.s, w: b.w, n: b.n, e: b.e }, NX, NY, grid });
}
