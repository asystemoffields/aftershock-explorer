// app.js — Aftershock Forecast Explorer UI.
import { REGIMES, DEFAULT_REGIME, PARAMS_VERIFIED, expectedCount, probAtLeastOne, ratePerDay } from './aftershock.js';
import { fetchFeed, fetchEvent } from './comcat.js';

const $ = (id) => document.getElementById(id);
const state = { Mm: 7.0, place: '(magnitude 7.0 scenario)', time: Date.now(), regime: DEFAULT_REGIME, elapsed: 0 };
let quakes = [];

const FEEDS = [
  { v: 'significant_month', t: 'Significant — past month' },
  { v: '4.5_month', t: 'M4.5+ — past month' },
  { v: '2.5_week', t: 'M2.5+ — past week' },
];
const MAG_THRESHOLDS = [3, 4, 5, 6];
const MAG_MIN = 3, MAG_MAX = 9.6;

const fmtPct = (p) => { const x = p * 100; return x >= 1 ? Math.round(x) + '%' : x >= 0.1 ? x.toFixed(1) + '%' : x > 0 ? '<0.1%' : '0%'; };
const pctClass = (p) => { const x = p * 100; return x >= 50 ? 'p-hi' : x >= 5 ? 'p-md' : 'p-lo'; };
const fmtExp = (n) => (n >= 10 ? Math.round(n) : n >= 1 ? n.toFixed(1) : n >= 0.1 ? n.toFixed(2) : n > 0 ? n.toExponential(0) : '0');
const fmtTime = (ms) => { try { return new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; } catch (e) { return ''; } };

function setStatus(msg, isError) {
  const s = $('status'); if (!s) return;
  s.textContent = msg; s.classList.remove('hidden'); s.classList.toggle('err', !!isError);
}
function clearStatus() { const s = $('status'); if (s) s.classList.add('hidden'); }

function setMainshock(q) {
  if (!Number.isFinite(q.mag)) { setStatus('That event has no magnitude — try another.', true); return; }
  state.Mm = q.mag; state.place = q.place; state.time = q.time;
  $('ms-mag').textContent = 'M' + Number(q.mag).toFixed(1);
  $('ms-place').textContent = q.place || q.title || '';
  const bits = [];
  if (q.time) bits.push(fmtTime(q.time));
  if (q.magType) bits.push(String(q.magType).toUpperCase());
  $('ms-time').textContent = bits.join(' · ');
  if (q.type && q.type !== 'earthquake')
    setStatus(`Note: this event is classified as “${q.type}”, not an earthquake — the model assumes a tectonic mainshock.`, false);
  else clearStatus();
  render();
}

function render() {
  const P = REGIMES[state.regime], e = state.elapsed;
  const windows = [
    { label: '24 h', t2: 1 }, { label: '1 week', t2: 7 },
    { label: '1 month', t2: 30 }, { label: '1 year', t2: 365 },
  ].map((w) => ({ label: w.label, t1: e, t2: e + w.t2 }));

  const rows = MAG_THRESHOLDS.map((M0) => ({ label: 'M ≥ ' + M0, M0, larger: false }));
  rows.push({ label: '≥ M' + state.Mm.toFixed(1) + ' (larger than mainshock)', M0: state.Mm, larger: true });

  const sig = Math.pow(10, P.aSigma); // 1σ multiplicative spread on the rate
  let html = '<table aria-label="Aftershock forecast: chance and expected number by magnitude and time window">'
    + '<thead><tr><th scope="col">magnitude</th>' + windows.map((w) => `<th scope="col">${w.label}</th>`).join('') + '</tr></thead><tbody>';
  for (const r of rows) {
    html += `<tr${r.larger ? ' class="larger"' : ''}><th scope="row" class="mag">${r.label}</th>`;
    for (const w of windows) {
      const ex = expectedCount(P, state.Mm, r.M0, w.t1, w.t2);
      const pr = probAtLeastOne(P, state.Mm, r.M0, w.t1, w.t2);
      const band = `≈ ${fmtExp(ex / sig)}–${fmtExp(ex * sig)} expected at 1σ uncertainty`;
      html += `<td><span class="pct ${pctClass(pr)}">${fmtPct(pr)}</span><span class="exp" title="${band}">~${fmtExp(ex)} expected</span></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  $('table-wrap').innerHTML = html;
  $('fc-sub').textContent = e > 0 ? `(starting ${e} day${e === 1 ? '' : 's'} after the mainshock)` : '';
  $('fc-note').innerHTML = '';
  $('fc-note').append(
    note(`Generic estimates carry large uncertainty — the true rate for this sequence could plausibly be several-fold higher or lower (≈ ×${sig.toFixed(1)} / ÷${sig.toFixed(1)} at 1σ), and would sharpen as real aftershocks are recorded.`),
    note('Rule of thumb: USGS notes any earthquake has roughly a 5% chance of being followed by a larger one nearby within a week; the model’s regime-specific estimate above can differ.'),
  );

  drawCurve(P);
  window.__STATE = { Mm: state.Mm, regime: state.regime, elapsed: e, verified: PARAMS_VERIFIED,
    week_M3_prob: +probAtLeastOne(P, state.Mm, 3, e, e + 7).toFixed(4) };
}
function note(text) { const d = document.createElement('div'); d.textContent = text; return d; }

function drawCurve(P) {
  const cv = $('curve'), dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 760, H = 280;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const x0 = 48, x1 = W - 12, y0 = H - 28, y1 = 12;
  const tMin = 0.01, tMax = 365, lxMin = Math.log10(tMin), lxMax = Math.log10(tMax);
  const lines = [{ M0: 3, c: '#f0883e' }, { M0: 5, c: '#7aa2f7' }];
  const N = 120;
  const series = lines.map((L) => {
    const pts = [];
    for (let i = 0; i <= N; i++) { const t = Math.pow(10, lxMin + (lxMax - lxMin) * i / N); pts.push([t, ratePerDay(P, state.Mm, L.M0, t)]); }
    return { ...L, pts };
  });
  let rmin = Infinity, rmax = -Infinity;
  for (const s of series) for (const [, r] of s.pts) if (r > 0) { rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); }
  if (!isFinite(rmin) || rmin <= 0) rmin = 1e-3;
  const lyMin = Math.floor(Math.log10(rmin)), lyMax = Math.max(lyMin + 1, Math.ceil(Math.log10(rmax)));
  const X = (t) => x0 + (Math.log10(t) - lxMin) / (lxMax - lxMin) * (x1 - x0);
  const Y = (r) => y0 - (Math.log10(r) - lyMin) / (lyMax - lyMin) * (y0 - y1);

  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.fillStyle = '#8b949e'; ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  for (const t of [0.01, 0.1, 1, 10, 100, 365]) { const x = X(t); ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y0); ctx.stroke(); ctx.fillText(t + 'd', x, y0 + 14); }
  ctx.textAlign = 'right';
  for (let ly = lyMin; ly <= lyMax; ly++) { const y = Y(Math.pow(10, ly)); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillText('10' + sup(ly), x0 - 5, y + 3); }
  for (const s of series) {
    ctx.strokeStyle = s.c; ctx.lineWidth = 2; ctx.beginPath();
    s.pts.forEach(([t, r], i) => { const x = X(t), y = Y(Math.max(r, Math.pow(10, lyMin))); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }
  const tnow = Math.max(state.elapsed, tMin);
  if (tnow <= tMax) { const x = X(tnow); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y0); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#e6edf3'; ctx.textAlign = 'center'; ctx.fillText('now', x, y1 + 9); }
  $('curve-legend').innerHTML = series.map((s) => `<span><i style="background:${s.c}"></i>aftershocks ≥ M${s.M0} / day</span>`).join('');
}
const sup = (n) => String(n).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);

async function loadFeed() {
  $('quake').innerHTML = '<option>— loading… —</option>';
  try {
    quakes = await fetchFeed($('feed').value);
    const sel = $('quake'); sel.innerHTML = '';
    if (!quakes.length) { sel.innerHTML = '<option value="">— none in this feed —</option>'; return; }
    const ph = document.createElement('option'); ph.value = ''; ph.textContent = `— ${quakes.length} quakes — pick one —`; sel.appendChild(ph);
    quakes.forEach((q, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `M${q.mag != null ? q.mag.toFixed(1) : '?'} — ${q.place || q.title || q.id}`; sel.appendChild(o); });
    clearStatus();
  } catch (e) {
    $('quake').innerHTML = '<option value="">— unavailable —</option>';
    setStatus('Couldn’t load the recent-quake list (' + e.message + '). You can still set a magnitude or load by ID.', true);
  }
}
async function loadById() {
  const id = $('in-id').value.trim(); if (!id) return;
  setStatus('Loading ' + id + '…', false);
  try { setMainshock(await fetchEvent(id)); } // setMainshock clears/sets status
  catch (e) { setStatus(`Couldn’t load "${id}": ${e.message}. The mainshock below is unchanged.`, true); }
}

function openHelp() { $('help-modal').classList.remove('hidden'); $('help-close').focus(); }
function closeHelp() { $('help-modal').classList.add('hidden'); $('btn-help').focus(); }

let resizeRaf = 0;
function init() {
  for (const [k, v] of Object.entries(REGIMES)) { const o = document.createElement('option'); o.value = k; o.textContent = v.label; $('regime').appendChild(o); }
  $('regime').value = DEFAULT_REGIME;
  $('regime').addEventListener('change', (e) => { state.regime = e.target.value; render(); });
  for (const f of FEEDS) { const o = document.createElement('option'); o.value = f.v; o.textContent = f.t; $('feed').appendChild(o); }
  $('feed').addEventListener('change', loadFeed);
  $('quake').addEventListener('change', () => { const q = quakes[+$('quake').value]; if (q) setMainshock(q); });
  $('btn-mag').addEventListener('click', () => {
    const m = parseFloat($('in-mag').value);
    if (Number.isFinite(m) && m >= MAG_MIN && m <= MAG_MAX) setMainshock({ mag: m, place: `(magnitude ${m.toFixed(1)} scenario)`, time: Date.now() });
    else setStatus(`Enter a magnitude between ${MAG_MIN} and ${MAG_MAX}.`, true);
  });
  $('btn-id').addEventListener('click', loadById);
  $('in-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadById(); });
  $('elapsed').addEventListener('input', (e) => { state.elapsed = +e.target.value; $('elapsed-lab').textContent = `${state.elapsed} day${state.elapsed === 1 ? '' : 's'}`; render(); });
  $('btn-help').addEventListener('click', openHelp);
  $('help-close').addEventListener('click', closeHelp);
  $('help-modal').addEventListener('click', (e) => { if (e.target.id === 'help-modal') closeHelp(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('help-modal').classList.contains('hidden')) closeHelp(); });
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(render); });

  if (!PARAMS_VERIFIED) { const n = $('param-notice'); n.classList.remove('hidden'); n.textContent = 'Model parameters are provisional.'; }
  $('help-params').textContent = 'Model: Reasenberg-Jones generic parameters (a, b, p, c) by tectonic setting, from USGS OAF operational values — Page et al. (2016) globally, Hardebeck et al. (2018) for California.';

  setMainshock({ mag: 7.0, place: '(magnitude 7.0 scenario)', time: Date.now() });
  loadFeed();
  window.__setMag = (m) => setMainshock({ mag: m, place: '(test)', time: Date.now() });
  window.__READY = true;
}

try { init(); } catch (e) { window.__ERR = String(e) + '\n' + (e && e.stack); }
