// Climate router: high-fidelity Copernicus (ERA5-Land + CMIP6 ssp245) when ENABLE_CDS=1 and
// python/cdsapi are configured; otherwise the live Open-Meteo readout.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getClimateLive } from './climate_live.js';
const run = promisify(execFile);

export async function getClimate(lat, lon) {
  if (process.env.ENABLE_CDS === '1') {
    try {
      const { stdout } = await run('python3', ['src/adapters/climate_cds.py', String(lat), String(lon)], { timeout: 15 * 60 * 1000 });
      return JSON.parse(stdout);
    } catch (e) { /* CDS queue/timeout → fall back */ }
  }
  return getClimateLive(lat, lon);
}
