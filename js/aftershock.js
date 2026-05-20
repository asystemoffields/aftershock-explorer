// aftershock.js — Reasenberg-Jones / modified-Omori aftershock-forecast math.
//   rate λ(t,M) = 10^(a + b·(Mm − M)) · (t + c)^(−p)   [aftershocks ≥ M per day, t in days]
//   expected count over [T1,T2] = 10^(a+b(Mm−M0)) · ∫_{T1}^{T2}(t+c)^(−p) dt
//   P(≥1) = 1 − exp(−expected count)   [Poisson]
// See docs/MODEL_NOTES.md. This is an EDUCATIONAL explainer, not an authoritative forecast.
//
// Generic Reasenberg-Jones parameters by tectonic regime, transcribed from USGS's operational
// Aftershock Forecasting (OAF) source — opensha-oaf `GenericRJ_ParametersFetch.json` /
// `PageEtAlGenericParams_032116.csv` — i.e. Page et al. (2016) globally + Hardebeck et al. (2018)
// for California. `aSigma` is the operational 1σ uncertainty on `a` (log10). b = 1.00 for all.
export const REGIMES = {
  shallow_cont: { label: 'Shallow continental (generic)',   a: -2.42, b: 1.00, p: 0.98, c: 0.018,  aSigma: 0.63 },
  deep_cont:    { label: 'Deep continental',                a: -2.13, b: 1.00, p: 0.98, c: 0.018,  aSigma: 0.52 },
  subduction:   { label: 'Subduction zone',                 a: -2.47, b: 1.00, p: 0.88, c: 0.018,  aSigma: 0.63 },
  stable_cont:  { label: 'Stable continental interior',     a: -2.85, b: 1.00, p: 0.73, c: 0.018,  aSigma: 0.78 },
  stable_ocean: { label: 'Stable oceanic',                  a: -3.04, b: 1.00, p: 0.97, c: 0.018,  aSigma: 0.67 },
  hotspot:      { label: 'Hotspot / volcanic',              a: -3.00, b: 1.00, p: 1.12, c: 0.018,  aSigma: 0.68 },
  oceanic_bdy:  { label: 'Oceanic boundary',                a: -3.19, b: 1.00, p: 1.08, c: 0.018,  aSigma: 0.60 },
  cal_south:    { label: 'California — Southern',           a: -2.30, b: 1.00, p: 0.83, c: 0.0033, aSigma: 0.50 },
  cal_north:    { label: 'California — Northern',           a: -2.64, b: 1.00, p: 0.96, c: 0.012,  aSigma: 0.48 },
};
export const DEFAULT_REGIME = 'shallow_cont';
export const PARAMS_VERIFIED = true;

// ∫_{t1}^{t2} (t+c)^(−p) dt  (handles the p=1 logarithmic case).
function omoriIntegral(c, p, t1, t2) {
  if (Math.abs(p - 1) < 1e-9) return Math.log((t2 + c) / (t1 + c));
  return (Math.pow(t2 + c, 1 - p) - Math.pow(t1 + c, 1 - p)) / (1 - p);
}

// Expected number of aftershocks of magnitude ≥ M0 in [t1,t2] days after an Mm mainshock.
export function expectedCount(P, Mm, M0, t1, t2) {
  return Math.pow(10, P.a + P.b * (Mm - M0)) * omoriIntegral(P.c, P.p, t1, t2);
}
// Probability of one or more such aftershocks (Poisson).
export const probAtLeastOne = (P, Mm, M0, t1, t2) => 1 - Math.exp(-expectedCount(P, Mm, M0, t1, t2));

// Instantaneous daily rate of aftershocks ≥ M0 at time t (days) — for the decay curve.
export const ratePerDay = (P, Mm, M0, t) => Math.pow(10, P.a + P.b * (Mm - M0)) * Math.pow(t + P.c, -P.p);

// (forecast windows + table are built in app.js, where the elapsed-time offset is applied.)
