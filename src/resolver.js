// Server copy of the app's data-source catalog. Keeps frontend and backend in agreement:
// same coverage boxes, same priorities, same "best source per element" result.

const inBox = (la, lo, s, w, n, e) => la >= s && la <= n && lo >= w && lo <= e;
const box = (s, w, n, e) => (la, lo) => inBox(la, lo, s, w, n, e);
const GLOBAL = () => true;
const inUS = (la, lo) =>
  inBox(la, lo, 24.5, -125, 49.5, -66.5) ||
  inBox(la, lo, 51, -170, 71, -129) ||
  inBox(la, lo, 18.5, -160, 22.5, -154);
const inEU = (la, lo) => inBox(la, lo, 34, -25, 72, 45);

export const DATA_SOURCES = [
  // buildings
  { el: 'buildings', name: 'City of Vienna 3D (B3DM)', res: 'LOD2', access: 'import', prio: 1, covers: box(48.10, 16.18, 48.33, 16.58), note: '3D Tiles B3DM' },
  { el: 'buildings', name: 'Rotterdam LOD2 (Virtual City Systems)', res: 'LOD2', access: 'import', prio: 1, covers: box(51.85, 4.35, 52.00, 4.60), note: 'overrides 3D BAG here' },
  { el: 'buildings', name: 'Barcelona LOD2 (I3S)', res: 'LOD2', access: 'import', prio: 1, covers: box(41.32, 2.05, 41.47, 2.24) },
  { el: 'buildings', name: 'Madrid LOD2 (I3S)', res: 'LOD2', access: 'import', prio: 1, covers: box(40.31, -3.84, 40.56, -3.55) },
  { el: 'buildings', name: 'NYC DoITT buildings', res: 'LOD1/2', access: 'import', prio: 1, covers: box(40.49, -74.27, 40.92, -73.68), note: '~1.1M bldgs' },
  { el: 'buildings', name: 'Washington DC (CyberCity3D)', res: 'LOD2', access: 'import', prio: 1, covers: box(38.79, -77.12, 38.996, -76.91) },
  { el: 'buildings', name: 'Boston (BPDA)', res: 'LOD2', access: 'import', prio: 1, covers: box(42.30, -71.19, 42.40, -71.00) },
  { el: 'buildings', name: 'Prague LOD2 (IPR Praha)', res: 'LOD2', access: 'import', prio: 1, covers: box(49.94, 14.22, 50.18, 14.71) },
  { el: 'buildings', name: 'LGL-BW 3D Tiles', res: 'LOD2', access: 'import', prio: 2, covers: box(47.5, 7.5, 49.8, 10.5), note: 'Baden-Württemberg' },
  { el: 'buildings', name: 'basemap.de 3D', res: 'LOD2', access: 'import', prio: 3, covers: box(47.2, 5.8, 55.1, 15.1), note: 'Germany' },
  { el: 'buildings', name: 'swissBUILDINGS3D (swisstopo)', res: 'LOD2', access: 'import', prio: 3, covers: box(45.8, 5.9, 47.8, 10.5) },
  { el: 'buildings', name: '3D BAG', res: 'LOD1.2/2.2', access: 'import', prio: 3, covers: box(50.75, 3.35, 53.6, 7.25), note: 'Netherlands (CityJSON)' },
  { el: 'buildings', name: 'Project PLATEAU', res: 'LOD1-3', access: 'import', prio: 3, covers: box(24, 122, 46, 146), note: 'Japan' },
  { el: 'buildings', name: 'Maa-amet LOD2', res: 'LOD2', access: 'import', prio: 3, covers: box(57.5, 21.7, 59.7, 28.2), note: 'Estonia' },
  { el: 'buildings', name: 'OneMap 3D', res: 'LOD1', access: 'import', prio: 3, covers: box(1.20, 103.60, 1.48, 104.05), note: 'Singapore' },
  { el: 'buildings', name: 'VWorld 3D buildings (Korea)', res: 'LOD1/3-4', access: 'key', prio: 2, covers: box(33.0, 124.5, 38.7, 131.0), note: 'Korea-only; 2D footprints via Data API' },
  { el: 'buildings', name: 'Overture Maps buildings', res: 'footprint+height', access: 'key', prio: 5, covers: GLOBAL, note: 'GeoParquet via DuckDB' },
  { el: 'buildings', name: 'OpenStreetMap', res: 'footprint+tags', access: 'live', prio: 5, covers: GLOBAL },
  // terrain
  { el: 'terrain', name: 'LGL-BW DGM025', res: '0.25 m', access: 'import', prio: 2, covers: box(47.5, 7.5, 49.8, 10.5), note: 'BW WCS' },
  { el: 'terrain', name: 'Denmark DHM', res: '0.4 m', access: 'import', prio: 3, covers: box(54.5, 8.0, 57.8, 12.7), note: 'Dataforsyningen (token)' },
  { el: 'terrain', name: 'AHN4', res: '0.5 m', access: 'import', prio: 3, covers: box(50.75, 3.35, 53.6, 7.25), note: 'PDOK' },
  { el: 'terrain', name: 'swissALTI3D', res: '0.5 m', access: 'import', prio: 3, covers: box(45.8, 5.9, 47.8, 10.5), note: 'swisstopo STAC' },
  { el: 'terrain', name: 'LGLN DGM1', res: '1 m', access: 'import', prio: 2, covers: box(51.3, 6.6, 53.9, 11.6), note: 'Lower Saxony COG' },
  { el: 'terrain', name: 'open DGM1 (DE states)', res: '1 m', access: 'import', prio: 3, covers: box(47.2, 5.8, 55.1, 15.1), note: 'per-state WCS' },
  { el: 'terrain', name: 'VWorld DEM (Korea)', res: '~5 m', access: 'key', prio: 3, covers: box(33.0, 124.5, 38.7, 131.0), note: 'Korea-only' },
  { el: 'terrain', name: 'USGS NED 10 m', res: '10 m', access: 'live', prio: 4, covers: inUS, provider: 'ned10m' },
  { el: 'terrain', name: 'EU-DEM 25 m', res: '25 m', access: 'live', prio: 4, covers: inEU, provider: 'eudem25m' },
  { el: 'terrain', name: 'ESRI Terrain 3D', res: '~1.6-2 m', access: 'key', prio: 4, covers: GLOBAL, note: 'ArcGIS (key)' },
  { el: 'terrain', name: 'Copernicus GLO-90 (Open-Meteo)', res: '90 m', access: 'live', prio: 5, covers: GLOBAL, provider: 'open-meteo' },
  { el: 'terrain', name: 'ASTER / SRTM 30 m', res: '30 m', access: 'live', prio: 5, covers: GLOBAL, provider: 'aster30m' },
  // climate
  { el: 'climate', name: 'ERA5-Land', res: '~9 km', access: 'key', prio: 2, covers: GLOBAL, note: 'CDS' },
  { el: 'climate', name: 'Copernicus Interactive Climate Atlas', res: 'CMIP6', access: 'key', prio: 2, covers: GLOBAL },
  { el: 'climate', name: 'SSP2-4.5 projection (2050)', res: 'CMIP6', access: 'key', prio: 2, covers: GLOBAL },
  { el: 'climate', name: 'Open-Meteo Climate API (CMIP6, ~SSP2-4.5)', res: '~10 km', access: 'live', prio: 3, covers: GLOBAL },
  // vegetation
  { el: 'vegetation', name: 'Overture Maps trees', res: 'point', access: 'key', prio: 4, covers: GLOBAL, note: 'DuckDB' },
  { el: 'vegetation', name: 'OpenStreetMap trees', res: 'point', access: 'live', prio: 5, covers: GLOBAL }
];

const clean = s => { const { covers, ...rest } = s; return rest; };

export function resolveBest(lat, lon) {
  const out = {};
  for (const el of ['buildings', 'terrain', 'climate', 'vegetation']) {
    out[el] = DATA_SOURCES.filter(s => s.el === el && s.covers(lat, lon))
      .sort((a, b) => a.prio - b.prio)
      .map(clean);
  }
  return out;
}

// Best live DEM providers (OpenTopoData / Open-Meteo) ordered best-first for a point.
export function demChain(lat, lon) {
  return DATA_SOURCES
    .filter(s => s.el === 'terrain' && s.provider && s.covers(lat, lon))
    .sort((a, b) => a.prio - b.prio)
    .map(s => s.provider);
}
