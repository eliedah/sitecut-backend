import Fastify from 'fastify';
import cors from '@fastify/cors';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { resolveBest } from './resolver.js';
import { cached } from './cache.js';
import { getBuildings } from './adapters/buildings_router.js';
import { getOSM } from './adapters/osm.js';
import { getOvertureTrees } from './adapters/overture.js';
import { getDEM } from './adapters/dem_router.js';
import { getClimate } from './adapters/climate.js';
import { computeKPIs } from './kpi.js';
import { getPointCloud, getPointCloudLAZ } from './adapters/pointcloud.js';
import { createReadStream } from 'node:fs';

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.CORS_ORIGIN || true });

const bbox = q => ({ s: +q.s, w: +q.w, n: +q.n, e: +q.e });
const bad = q => [q.s, q.w, q.n, q.e].some(v => v === undefined || isNaN(+v));

app.get('/health', async () => ({ ok: true, ts: Date.now() }));

// --- user registration (name + email) ---
const DATA_DIR = process.env.DATA_DIR || './data';
const REG_FILE = DATA_DIR + '/registrations.jsonl';

app.post('/api/register', async (req, reply) => {
  const { name, email, consent } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return reply.code(400).send({ error: 'valid email required' });
  const rec = {
    name: String(name || '').slice(0, 120),
    email: String(email).slice(0, 160),
    consent: !!consent,
    ts: new Date().toISOString(),
    ip: req.ip
  };
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await appendFile(REG_FILE, JSON.stringify(rec) + '\n');
  } catch (e) { req.log.error(e); return reply.code(500).send({ error: 'could not save' }); }
  return { ok: true };
});

// simple protected list of signups (set ADMIN_TOKEN in .env, then GET /api/registrations?token=...)
app.get('/api/registrations', async (req, reply) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.query.token !== token) return reply.code(401).send({ error: 'unauthorized' });
  try {
    const txt = await readFile(REG_FILE, 'utf8');
    const rows = txt.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
    return { count: rows.length, rows };
  } catch { return { count: 0, rows: [] }; }
});

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

// LiDAR point cloud (scan layer) — decimated JSON for rendering
app.get('/api/pointcloud', async (req, reply) => {
  if (bad(req.query)) return reply.code(400).send({ error: 'bbox s,w,n,e required' });
  const b = bbox(req.query);
  const max = Math.min(3000000, Number(req.query.max) || 1500000);
  const data = await cached(['pc', b, max], async () => {
    const d = await getPointCloud(b, max);
    return d ? { n: d.n, xyz: d.xyz, rgb: d.rgb, hasRGB: d.hasRGB, available: true }
             : { n: 0, xyz: [], rgb: null, hasRGB: false, available: false };
  });
  if (!data.n) return { n: 0, available: false, note: 'No free LiDAR coverage for this site (or ENABLE_PDAL=0).' };
  return data;
});

// LiDAR raw LAZ for download
app.get('/api/pointcloud.laz', async (req, reply) => {
  if (bad(req.query)) return reply.code(400).send({ error: 'bbox s,w,n,e required' });
  const b = bbox(req.query);
  const laz = await getPointCloudLAZ(b, Math.min(8000000, Number(req.query.max) || 4000000));
  if (!laz) return reply.code(404).send({ error: 'No LiDAR available for this site.' });
  reply.header('Content-Type', 'application/octet-stream');
  reply.header('Content-Disposition', 'attachment; filename="sitecut_scan.laz"');
  return reply.send(createReadStream(laz));
});

const port = Number(process.env.PORT) || 8080;
app.listen({ port, host: '0.0.0.0' }).then(() => app.log.info(`sitecut-backend on :${port}`));
