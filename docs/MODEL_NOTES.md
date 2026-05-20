# Aftershock Forecast Explorer — model & data notes (HANDOFF)

**Status: BUILT + browser-verified (2026-05-20)** — originally tabled, then built; the open
parameter item is RESOLVED (verified verbatim from USGS OAF source: Page 2016 + Hardebeck 2018,
shipped in `web/js/aftershock.js`). See README. Below is the original design log. Started early "while we wait"; paused to build the
prioritized heat (#2) and quantum (#3) tools first. This file is the resume point.

## What this is
An open, GLOBAL, educational aftershock-forecast **explainer** (NOT an authoritative
alarm). Pick any earthquake → see the expected number / probability of aftershocks
over time, computed client-side from published models over USGS public-domain data.
Fills the gap that USGS issues operational forecasts only for the US/territories and
*won't* publish them internationally (sovereignty/ethics). See `../candidates.md` R2-1.

## VERIFIED so far (2026-05-20)
- **USGS ComCat is directly browser-fetchable — no backend/proxy/pipeline needed.**
  - Single event: `https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=<id>&format=geojson`
  - Recent significant: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson`
    (also `4.5_month`, `2.5_week`, etc.)
  - Both returned **HTTP 200** with **`Access-Control-Allow-Origin: *`** → fetch from a static
    GitHub Pages site works cross-origin. (Confirmed via Invoke-WebRequest, 2026-05-20.)
  - GeoJSON FeatureCollection; per-feature `properties`: `mag`, `magType`, `place`, `time`
    (ms epoch UTC), `type`, `url`, `detail`; `geometry.coordinates = [lon, lat, depth_km]`;
    feature `id` = the event id (e.g. `us6000jllz` = 2023 Türkiye M7.8).
  - NB: `ConvertFrom-Json` chokes on an empty-string property name in the detail JSON — use
    `-AsHashtable` when parsing in PowerShell. (JS `JSON.parse` is fine.)
- **License:** USGS data = US-government work, public domain. Attribute USGS; consider
  EMSC-CSEM as a distribution partner.

## The model (Reasenberg–Jones / modified Omori) — form is textbook; PARAMS need verifying
Rate of aftershocks of magnitude ≥ M at time t (days) after a mainshock of magnitude Mm:

    λ(t, M) = 10^(a + b·(Mm − M)) · (t + c)^(−p)

Expected count of aftershocks ≥ M0 in the time window [T1, T2] days:

    N(M0; T1,T2) = 10^(a + b·(Mm − M0)) · Ω(T1,T2)
    Ω(T1,T2) = ∫_{T1}^{T2} (t+c)^(−p) dt
             = ((T2+c)^(1−p) − (T1+c)^(1−p)) / (1 − p)      if p ≠ 1
             = ln((T2+c)/(T1+c))                             if p = 1

Probability of ≥1 aftershock of magnitude ≥ M0 in [T1,T2] (Poisson):

    P(≥1) = 1 − exp(−N(M0; T1,T2))

"Probability of a larger earthquake" ⇒ set M0 = Mm. Report windows: next day / 7d / 30d / 1y;
magnitudes M≥3, 4, 5, 6, and ≥Mm.

## THE ONE OPEN ITEM (do not ship guesses) — verify before building
The generic parameters **(a, b, p, c) per tectonic regime** from Page et al. 2016 (BSSA,
"Three Ingredients for Improved Global Aftershock Forecasts"). The BSSA table is paywalled;
**re-derive from open USGS OAF code** (`code.usgs.gov`, the `mtpage/Aftershocks` / OAF repos)
and OFR 94-221 (free PDF). Classify a quake's regime with `usgs/strec` (public domain) at
*pipeline time*, bake a tiny static `{regime → a,b,p,c}` JSON, and look it up client-side.
PROVISIONAL placeholders ONLY for wiring the math (Reasenberg–Jones 1994 generic California,
**flagged, not for release**): a≈−1.67, b≈0.91, p≈1.08, c≈0.05 days.

## Build plan when resumed
1. Verify the Page-2016 regime params (above). 2. `web/js/aftershock.js`: λ, N, Ω, P, plus a
forecast table + log-log decay curve. 3. `web/js/comcat.js`: fetch event by id + a
"recent significant quakes" picker. 4. UI: pick a quake → forecast table + decay plot +
prominent **"education/transparency, not an official warning — consult local authorities"**
framing and parameter-uncertainty notes. 5. Build against a hardcoded sample (Türkiye M7.8:
mag 7.8, 2023-02-06 01:17 UTC, ~37.2°N 37.0°E, depth ~10 km, id `us6000jllz` — confirm exact
values via ComCat) so it works offline; then wire live ComCat. 6. cb-harness verify + audit.
