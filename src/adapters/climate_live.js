// Live climate via Open-Meteo Climate API (CMIP6 HighResMIP, ~SSP2-4.5 to 2050). No key.
const MODELS = 'MRI_AGCM3_2_S,EC_Earth3P_HR,MPI_ESM1_2_XR';

async function window_(lat, lon, start, end) {
  const url = 'https://climate-api.open-meteo.com/v1/climate'
    + `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
    + `&start_date=${start}&end_date=${end}&models=${MODELS}`
    + '&daily=temperature_2m_mean,precipitation_sum';
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 25000);
  const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const daily = (await r.json()).daily || {};
  const tKeys = Object.keys(daily).filter(k => k.startsWith('temperature_2m_mean'));
  const pKeys = Object.keys(daily).filter(k => k.startsWith('precipitation_sum'));
  let tSum = 0, tN = 0; tKeys.forEach(k => daily[k].forEach(v => { if (v != null) { tSum += v; tN++; } }));
  const days = (daily.time || []).length, years = Math.max(1, days / 365.25);
  let pTot = 0, pKn = 0; pKeys.forEach(k => { let s = 0, any = false; daily[k].forEach(v => { if (v != null) { s += v; any = true; } }); if (any) { pTot += s; pKn++; } });
  return { meanT: tN ? tSum / tN : null, annualP: pKn ? (pTot / pKn) / years : null };
}

export async function getClimateLive(lat, lon) {
  const [fut, base] = await Promise.all([
    window_(lat, lon, '2041-01-01', '2050-12-31'),
    window_(lat, lon, '2001-01-01', '2010-12-31')
  ]);
  const dT = (fut.meanT != null && base.meanT != null) ? +(fut.meanT - base.meanT).toFixed(1) : null;
  const dP = (fut.annualP != null && base.annualP > 0) ? +(((fut.annualP - base.annualP) / base.annualP) * 100).toFixed(1) : null;
  return {
    source: 'Open-Meteo Climate API (CMIP6, ~SSP2-4.5)',
    baseline: { meanT: base.meanT != null ? +base.meanT.toFixed(1) : null, annualP: base.annualP != null ? Math.round(base.annualP) : null },
    y2050: { meanT: fut.meanT != null ? +fut.meanT.toFixed(1) : null, annualP: fut.annualP != null ? Math.round(fut.annualP) : null },
    delta: { T: dT, P_pct: dP }
  };
}
