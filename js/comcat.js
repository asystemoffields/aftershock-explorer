// comcat.js — USGS earthquake data (ComCat). Public domain. CORS-open (Access-Control-Allow-Origin:*),
// so these fetch directly from the browser — no key, no backend.

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary';
const QUERY = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

// fetch + parse JSON with a hard timeout (so a slow/down USGS can't hang the UI forever).
async function fetchJson(url, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('request timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function parseFeature(f) {
  const g = f.geometry && f.geometry.coordinates ? f.geometry.coordinates : [null, null, null];
  const p = f.properties || {};
  return {
    id: f.id, mag: p.mag, magType: p.magType, place: p.place, title: p.title,
    time: p.time, type: p.type, url: p.url,
    lon: g[0], lat: g[1], depth: g[2],
  };
}

// A summary feed of recent quakes. feed e.g. 'significant_month', '4.5_month', '2.5_week'.
export async function fetchFeed(feed = 'significant_month') {
  const j = await fetchJson(`${FEED}/${feed}.geojson`);
  return (j.features || [])
    .filter((f) => f.properties && f.properties.type === 'earthquake' && f.properties.mag != null)
    .map(parseFeature)
    .sort((a, b) => b.time - a.time);
}

// A single event by USGS id (returns a GeoJSON Feature at top level).
export async function fetchEvent(id) {
  return parseFeature(await fetchJson(`${QUERY}?eventid=${encodeURIComponent(id)}&format=geojson`));
}
