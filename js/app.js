// app.js — Aftershock Forecast Explorer UI.
import { REGIMES, DEFAULT_REGIME, PARAMS_VERIFIED, expectedCount, ratePerDay } from './aftershock.js';
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

const fmtPct = (p) => { const x = p * 100; return x >= 1 ? Math.round(x) + '%' : x >= 0.1 ? x.toFixed(1) + '%' : x > 0 ? '<0.1%' : '0%'; };
const pctClass = (p) => { const x = p * 100; return x >= 50 ? 'p-hi' : x >= 5 ? 'p-md' : 'p-lo'; };
const fmtExp = (n) => (n >= 10 ? Math.round(n) : n >= 1 ? n.toFixed(1) : n >= 0.1 ? n.toFixed(2) : n > 0 ? n.toExponential(0) : '0');
const fmtTime = (ms) => { try { return new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; } catch (e) { return ''; } };

function setMainshock(mag, place, time) {
  state.Mm = mag; state.place = place; state.time = time;
  $('ms-mag').textContent = 'M' + Number(mag).toFixed(1);
  $('ms-place').textContent = place || '';
  $('ms-time').textContent = time ? fmtTime(time) : '';
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

  let html = '<table><thead><tr><th>magnitude</th>' + windows.map((w) => `<th>${w.label}</th>`).join('') + '</tr></thead><tbody>';
  for (const r of rows) {
    html += `<tr${r.larger ? ' class="larger"' : ''}><td class="mag">${r.label}</td>`;
    for (const w of windows) {
      const ex = expectedCount(P, state.Mm, r.M0, w.t1, w.t2);
      const pr = 1 - Math.exp(-ex);
      html += `<td><span class="pct ${pctClass(pr)}">${fmtPct(pr)}</span><span class="exp">~${fmtExp(ex)} expected</span></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  $('table-wrap').innerHTML = html;
  $('fc-sub').textContent = e > 0 ? `(starting ${e} day${e === 1 ? '' : 's'} after the mainshock)` : '';

  drawCurve(P);
  window.__STATE = {
    Mm: state.Mm, regime: state.regime, elapsed: e, verified: PARAMS_VERIFIED,
    week_M3_prob: +(1 - Math.exp(-expectedCount(P, state.Mm, 3, e, e + 7))).toFixed(4),
  };
}

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
  try {
    quakes = await fetchFeed($('feed').value);
    const sel = $('quake'); sel.innerHTML = '';
    if (!quakes.length) { sel.innerHTML = '<option>— none in this feed —</option>'; return; }
    const ph = document.createElement('option'); ph.value = ''; ph.textContent = `— ${quakes.length} quakes — pick one —`; sel.appendChild(ph);
    quakes.forEach((q, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `M${q.mag != null ? q.mag.toFixed(1) : '?'} — ${q.place || q.title || q.id}`; sel.appendChild(o); });
  } catch (e) { $('quake').innerHTML = '<option>— feed error —</option>'; }
}
async function loadById() {
  const id = $('in-id').value.trim(); if (!id) return;
  try { const q = await fetchEvent(id); if (q.mag == null) throw new Error('no magnitude'); setMainshock(q.mag, q.place || q.title, q.time); }
  catch (e) { $('ms-place').textContent = 'Could not load "' + id + '": ' + e.message; }
}

function init() {
  for (const [k, v] of Object.entries(REGIMES)) { const o = document.createElement('option'); o.value = k; o.textContent = v.label; $('regime').appendChild(o); }
  $('regime').value = DEFAULT_REGIME;
  $('regime').addEventListener('change', (e) => { state.regime = e.target.value; render(); });
  for (const f of FEEDS) { const o = document.createElement('option'); o.value = f.v; o.textContent = f.t; $('feed').appendChild(o); }
  $('feed').addEventListener('change', loadFeed);
  $('quake').addEventListener('change', () => { const q = quakes[+$('quake').value]; if (q) setMainshock(q.mag, q.place || q.title, q.time); });
  $('btn-mag').addEventListener('click', () => { const m = parseFloat($('in-mag').value); if (m >= 3 && m <= 9.9) setMainshock(m, `(magnitude ${m.toFixed(1)} scenario)`, Date.now()); });
  $('btn-id').addEventListener('click', loadById);
  $('in-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadById(); });
  $('elapsed').addEventListener('input', (e) => { state.elapsed = +e.target.value; $('elapsed-lab').textContent = `${state.elapsed} day${state.elapsed === 1 ? '' : 's'}`; render(); });
  $('btn-help').addEventListener('click', () => $('help-modal').classList.remove('hidden'));
  $('help-close').addEventListener('click', () => $('help-modal').classList.add('hidden'));
  $('help-modal').addEventListener('click', (e) => { if (e.target.id === 'help-modal') $('help-modal').classList.add('hidden'); });

  if (!PARAMS_VERIFIED) {
    const n = $('param-notice'); n.classList.remove('hidden');
    n.innerHTML = '⚙ <b>Model parameters are provisional</b> — being verified against Page et al. (2016). The probabilities illustrate the method; values are not final.';
  }
  $('help-params').textContent = 'Model: Reasenberg-Jones generic parameters (a, b, p, c) by tectonic setting, from USGS OAF operational values — Page et al. (2016) globally, Hardebeck et al. (2018) for California. Generic estimates carry large uncertainty (the per-sequence rate can differ several-fold); observed aftershocks would refine them.';

  setMainshock(7.0, '(magnitude 7.0 scenario)', Date.now());
  loadFeed();
  window.__setMag = (m) => setMainshock(m, '(test)', Date.now());
  window.__READY = true;
}

try { init(); } catch (e) { window.__ERR = String(e) + '\n' + (e && e.stack); }
