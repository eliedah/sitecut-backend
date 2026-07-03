// Chooses the best building source for a bbox and always falls back to OSM.
import { resolveBest } from '../resolver.js';
import { getOSM } from './osm.js';
import { getOvertureBuildings } from './overture.js';
import { getVWorldBuildings } from './vworld.js';

export async function getBuildings(b) {
  const best = resolveBest((b.s + b.n) / 2, (b.w + b.e) / 2).buildings[0];
  try {
    if (best?.name?.startsWith('VWorld')) return tag(await getVWorldBuildings(b), best.name);
    if (best?.name?.startsWith('Overture')) return tag(await getOvertureBuildings(b), best.name);
    // 'import' city/national LOD2 sets are not wired here yet — see citygml adapter in the guide.
  } catch (e) { /* fall back */ }
  return tag(await getOSM(b), 'OpenStreetMap');
}

function tag(fc, source) { fc._source = source; return fc; }
