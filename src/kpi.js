// Compute data-quality + urban KPIs from the assembled buildings FeatureCollection and DEM grid.

const R = 6378137;
function project(b) {
  const lat0 = (b.s + b.n) / 2 * Math.PI / 180;
  const mPerLon = (Math.PI / 180) * R * Math.cos(lat0);
  const mPerLat = (Math.PI / 180) * R;
  return { x: lon => (lon - b.w) * mPerLon, y: lat => (lat - b.s) * mPerLat };
}
function ringAreaM2(ring, p) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = p.x(ring[i][0]), y1 = p.y(ring[i][1]);
    const x2 = p.x(ring[i + 1][0]), y2 = p.y(ring[i + 1][1]);
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function computeKPIs(b, buildingsFC, dem) {
  const p = project(b);
  const siteArea = (b.e - b.w) * (b.n - b.s) === 0 ? 0
    : ((p.x(b.e) - p.x(b.w)) * (p.y(b.n) - p.y(b.s)));

  const feats = (buildingsFC?.features || []).filter(f => f.geometry?.type === 'Polygon');
  let footprint = 0, floorArea = 0, hSum = 0, hN = 0;
  for (const f of feats) {
    const ring = f.geometry.coordinates[0]; if (!ring || ring.length < 4) continue;
    const area = ringAreaM2(ring, p); footprint += area;
    const h = f.properties?.height;
    const floors = f.properties?.levels || (h ? Math.max(1, Math.round(h / 3.2)) : 1);
    floorArea += area * floors;
    if (h) { hSum += h; hN++; }
  }
  const GSI = siteArea ? footprint / siteArea : 0;
  const FSI = siteArea ? floorArea / siteArea : 0;
  const OSR = FSI ? (1 - GSI) / FSI : null;

  // terrain stats from the grid
  let meanEl = null, elMin = null, elMax = null, meanSlope = null;
  if (dem?.grid?.length) {
    const g = dem.grid, NY = g.length, NX = g[0].length;
    let sum = 0, n = 0; elMin = Infinity; elMax = -Infinity;
    for (const row of g) for (const v of row) { sum += v; n++; if (v < elMin) elMin = v; if (v > elMax) elMax = v; }
    meanEl = sum / n;
    const dxm = (p.x(b.e) - p.x(b.w)) / (NX - 1), dym = (p.y(b.n) - p.y(b.s)) / (NY - 1);
    let sSum = 0, sN = 0;
    for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const dzx = (g[j][i + 1] - g[j][i]) / dxm, dzy = (g[j + 1][i] - g[j][i]) / dym;
      sSum += Math.atan(Math.hypot(dzx, dzy)) * 180 / Math.PI; sN++;
    }
    meanSlope = sN ? sSum / sN : null;
  }

  const round = (v, d = 1) => v == null ? null : +v.toFixed(d);
  return {
    data_quality: {
      building_source: buildingsFC?._source || 'OpenStreetMap',
      building_count: feats.length,
      dem_source: dem?.source || null,
      dem_resolution_m: dem?.res_m ?? null,
      dem_tier: dem?.res_m == null ? null : dem.res_m <= 1 ? 'national-LiDAR' : dem.res_m <= 25 ? 'regional' : 'global'
    },
    urban: {
      site_area_m2: round(siteArea, 0),
      footprint_area_m2: round(footprint, 0),
      GSI: round(GSI, 3),
      FSI: round(FSI, 2),
      OSR: round(OSR, 2),
      mean_building_height_m: hN ? round(hSum / hN, 1) : null,
      mean_footprint_m2: feats.length ? round(footprint / feats.length, 0) : null
    },
    terrain: {
      mean_elevation_m: round(meanEl, 1),
      elevation_range_m: (elMin != null && isFinite(elMin)) ? round(elMax - elMin, 1) : null,
      mean_slope_deg: round(meanSlope, 1)
    }
  };
}
