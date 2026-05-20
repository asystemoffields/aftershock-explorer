// comcat.js — USGS earthquake data (ComCat). Public domain. CORS-open (Access-Control-Allow-Origin:*),
// so these fetch directly from the browser — no key, no backend.

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary';
const QUERY = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

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
  const r = await fetch(`${FEED}/${feed}.geojson`);
  if (!r.ok) throw new Error('feed fetch failed (' + r.status + ')');
  const j = await r.json();
  return (j.features || [])
    .filter((f) => f.properties && f.properties.type === 'earthquake' && f.properties.mag != null)
    .map(parseFeature)
    .sort((a, b) => b.time - a.time);
}

// A single event by USGS id (returns a GeoJSON Feature at top level).
export async function fetchEvent(id) {
  const r = await fetch(`${QUERY}?eventid=${encodeURIComponent(id)}&format=geojson`);
  if (!r.ok) throw new Error('event fetch failed (' + r.status + ')');
  return parseFeature(await r.json());
}
