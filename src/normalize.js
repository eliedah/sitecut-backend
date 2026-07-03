// Helpers to emit the three shapes the Sitecut frontend understands.

export function featureCollection(features) {
  return { type: 'FeatureCollection', features };
}

export function buildingFeature(coordsRing, { height = null, levels = null, source, id = null }) {
  return {
    type: 'Feature',
    properties: { layer: 'building', height, levels, source, id },
    geometry: { type: 'Polygon', coordinates: [coordsRing] }
  };
}

export function pointFeature(lon, lat, { layer = 'tree', source, id = null }) {
  return {
    type: 'Feature',
    properties: { layer, source, id },
    geometry: { type: 'Point', coordinates: [lon, lat] }
  };
}

// terrain grid the app's meteoElev() consumes directly
export function elevationGrid({ source, res_m, bbox, NX, NY, grid }) {
  return { source, res_m, bbox, NX, NY, grid };
}
