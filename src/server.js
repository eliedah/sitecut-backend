import Fastify from 'fastify';
import cors from '@fastify/cors';
import { resolveBest } from './resolver.js';
import { cached } from './cache.js';
import { getBuildings } from './adapters/buildings_router.js';
import { getOSM } from './adapters/osm.js';
import { getOvertureTrees } from './adapters/overture.js';
import { getDEM } from './adapters/dem_router.js';
import { getClimate } from './adapters/climate.js';
import { computeKPIs } from './kpi.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.CORS_ORIGIN || true });

const bbox = q => ({ s: +q.s, w: +q.w, n: +q.n, e: +q.e });
const bad = q => [q.s, q.w, q.n, q.e].some(v => v === undefined || isNaN(+v));

app.get('/health', async () => ({ ok: true, ts: Date.now() }));

app.get('/api/sources', async (req, reply) => {
  const { lat, lon } = req.query;
  if (lat === undefined || lon === undefined) return reply.code(400).send({ error: 'lat,lon required' });
  return resolveBest(+lat, +lon);
});

app.get('/api/buildings', async (req, reply) => {
  if (bad(req.query)) return reply.code(400).send({ error: 'bbox s,w,n,e required' });
  const b = bbox(req.query);
  return cached(['buildings', b], () => getBuildings(b));
});

app.get('/api/trees', async (req, reply) => {
  if (bad(req.query)) return reply.code(400).send({ error: 'bbox s,w,n,e required' });
  const b = bbox(req.query);
  return cached(['trees', b], async () => {
    try { return await getOvertureTrees(b); } catch { return await getOSM(b); } // OSM returns trees too
  });
});

app.get('/api/terrain', async (req, reply) => {
  if (bad(req.query)) return reply.code(400).send({ error: 'bbox s,w,n,e required' });
  const b = bbox(req.query);
  return cached(['terrain', b], () => getDEM(b));
});

app.get('/api/climate', async (req, reply) => {
  const { lat, lon } = req.query;
  if (lat === undefined || lon === undefined) return reply.code(400).send({ error: 'lat,lon required' });
  return cached(['climate', +(+lat).toFixed(2), +(+lon).toFixed(2)], () => getClimate(+lat, +lon));
});

app.get('/api/kpi', async (req, reply) => {
  if (bad(req.query)) return reply.code(400).send({ error: 'bbox s,w,n,e required' });
  const b = bbox(req.query);
  const [buildings, dem] = await Promise.all([
    cached(['buildings', b], () => getBuildings(b)),
    cached(['terrain', b], () => getDEM(b))
  ]);
  return computeKPIs(b, buildings, dem);
});

const port = Number(process.env.PORT) || 8080;
app.listen({ port, host: '0.0.0.0' }).then(() => app.log.info(`sitecut-backend on :${port}`));
