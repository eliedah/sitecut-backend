# Sitecut Backend

Multi-source data backend for Sitecut. Fetches the sources the browser can't (keys, non-CORS,
heavy formats), normalizes them to the shapes the app already consumes, runs the same
best-source-per-element resolver, and computes KPIs.

## What works out of the box (no keys)
- `GET /api/sources?lat&lon` — ranked best source per element (mirrors the app catalog)
- `GET /api/buildings?s&w&n&e` — Overture (if DuckDB present) else **OpenStreetMap**
- `GET /api/trees?s&w&n&e` — Overture trees (if DuckDB) else OSM trees
- `GET /api/terrain?s&w&n&e` — best live DEM (NED10m / EU-DEM25m / ASTER / Open-Meteo)
- `GET /api/climate?lat&lon` — Open-Meteo CMIP6 (~SSP2-4.5), or Copernicus if enabled
- `GET /api/kpi?s&w&n&e` — data-quality + urban KPIs (GSI/FSI/OSR, slope, elevation…)
- `GET /health`

Everything is cached to disk (`.cache`, TTL from `.env`).

## Run locally
```bash
cp .env.example .env          # fill keys as needed (all optional for the live endpoints)
npm install
npm start                     # http://localhost:8080
npm run smoke                 # hits every endpoint
```
Node 18+ required (uses global fetch). DuckDB/GDAL/Python are optional — without them the
routers fall back to the live sources automatically.

## Enable the key/import sources
| Source | Needs | How |
|---|---|---|
| Overture buildings/trees | DuckDB in PATH | `ENABLE_DUCKDB=1` (default); install duckdb CLI |
| National DTM COGs (AHN4, swissALTI3D, LGLN, LGL-BW, DHM) | GDAL in PATH | `ENABLE_GDAL=1`; implement each source's `resolveSrc()` in `src/adapters/dem_cog.js` (PDOK WCS / swisstopo STAC / state WCS) to return a `/vsicurl/…tif` URL |
| ESRI Terrain 3D | `ARCGIS_API_KEY` | global gap-filler, auto-used when set |
| Copernicus ERA5-Land + CMIP6 ssp245 | `~/.cdsapirc`, python3 + cdsapi/xarray | `ENABLE_CDS=1` |
| VWorld (Korea) | `VWORLD_KEY`, `VWORLD_DOMAIN`, Korea egress IP | building footprints via Data API |
| City/national LOD2 tilesets (PLATEAU, 3D BAG, basemap.de…) | GDAL `ogr2ogr` (CityGML) | add a `citygml.js` adapter → footprints+height (see the guide) |

## Deploy
```bash
# edit Caddyfile → your domain; register that domain with VWorld & ArcGIS
docker compose up -d --build
```
- Host on a small VPS (GDAL/DuckDB need CPU + a real filesystem).
- **VWorld** must egress from Korea — run that adapter (or the whole service) on a Korean host.
- Put secrets in `.env` (git-ignored); lock `CORS_ORIGIN` to your frontend domain in prod.
- Add cron: `0 3 * * * /app/scripts/etl_prebake.sh https://your-domain.example`

## Wire the frontend (Sitecut HTML)
Add near the top of the script:
```js
const API = 'https://your-domain.example';   // '' keeps the app fully client-side
```
Then:
1. **Buildings** — in `generate()`, if `API`, `fetch(`${API}/api/buildings?s=..&w=..&n=..&e=..`)` and
   feed the FeatureCollection into the existing footprint→extrude code (each feature has `height`).
2. **Terrain** — in `fetchTerrain()`, try `${API}/api/terrain?...`; the response is already the
   `{NX,NY,grid,bbox}` shape `meteoElev()` uses. Assign to `meteo`, set `elevSource='meteo'`,
   `elevInfo={label:source,res:res_m}`. Keep the live chain as fallback.
3. **Climate** — point the Climate panel at `${API}/api/climate?lat&lon` when `API` is set.
4. **KPIs** — add a button calling `${API}/api/kpi?...`, render the returned object.

All responses match the app's schemas, so no other changes are needed. With `API=''` the app runs
exactly as before, fully in the browser.

## Layout
```
src/server.js        routes            src/resolver.js     source catalog + best-source
src/cache.js         disk cache        src/normalize.js    common schemas
src/kpi.js           KPI math          src/adapters/*      one file per source
scripts/*.sh         GDAL/DuckDB/ETL   test/smoke.sh       endpoint check
Dockerfile / docker-compose.yml / Caddyfile
```
