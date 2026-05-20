# Aftershock Forecast Explorer

An open, global, **educational** explainer of how earthquake aftershock probabilities rise and
fade over time — built on published statistics (Reasenberg-Jones / modified-Omori) and public
USGS data. Pick a real earthquake or set a magnitude, and see the chance and expected number of
aftershocks at each magnitude over the next day / week / month / year. Computed live in your
browser; nothing is sent anywhere.

> **Educational explainer — not an official forecast or warning, and not real-time.** A forecast
> is *not* a prediction: it gives chances, not certainties. For authoritative aftershock
> forecasts and safety guidance, see [USGS](https://earthquake.usgs.gov/data/oaf/) and your
> national/local agency.

**Live:** _(deploy link TBD)_

## Why this exists

After a big quake, the most-asked question is "will there be more?" USGS issues operational
aftershock forecasts — but **only for the US and territories**, and (by policy) not
internationally. The underlying science is open and global. This tool applies the same published
model and USGS's own operational parameters to *any* earthquake, framed as a transparent
explainer — filling the gap for everyone outside the US footprint, journalists, and the curious,
and pushing back on the misinformation that follows large quakes.

## Features

- Choose a recent earthquake (USGS feeds), enter a magnitude, or load any **USGS event ID**.
- Forecast table: probability of **one or more** aftershocks (and the expected number) at
  M≥3/4/5/6 and **larger than the mainshock**, over a day / week / month / year.
- A **time-since-mainshock** slider shows how the danger decays.
- The **modified-Omori decay curve** (aftershocks/day vs. time), log-log.
- Nine **tectonic settings** (subduction, stable continental, California, …) with the right parameters.

## Run locally

No build step. `cd web && python -m http.server 8000`, then open `http://localhost:8000/`.

## The model

Reasenberg & Jones (1989/1994): rate `λ(t,M) = 10^(a + b·(Mm − M))·(t + c)^(−p)` (aftershocks ≥ M
per day, *t* in days). Expected count over a window is the integral of λ; the probability of one or
more is `1 − exp(−expected)` (Poisson). The generic `(a, b, p, c)` per tectonic regime are
**verified verbatim from USGS's operational OAF source code** — Page et al. (2016) globally and
Hardebeck et al. (2018) for California. Full notes + the math in [`docs/MODEL_NOTES.md`](docs/MODEL_NOTES.md).

**Caveat:** generic estimates carry large uncertainty — the true rate for a given sequence can
differ several-fold until observed aftershocks refine it. This is an *initial generic* forecast
(no sequence-specific Bayesian update), exactly what USGS itself issues in the first hours.

## Attribution & license

Earthquake data: **USGS** (public domain). Model: **Reasenberg & Jones (1989/1994)**; generic
parameters after **Page et al. (2016)** and **Hardebeck et al. (2018)**, as embodied in the
open-source [USGS OAF](https://code.usgs.gov/) code. Released under the **MIT License** (see
[`LICENSE`](LICENSE)).

One of a series of small, free, give-away tools for real science communities.
