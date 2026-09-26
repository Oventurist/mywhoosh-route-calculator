# MyWhoosh Route Calculator — Design Spec
Date: 2026-09-26 | Status: approved in chat (§§1–3) | Owner: Nick

## 1. Intent
Upload a cycling `.zwo` workout, enter FTP + weight, and see which
MyWhoosh routes fit inside the workout's allotted time — predicted with
a simple physics model, not just duration matching. Hosted on GitHub
Pages, usable from a phone. No server, no secrets, file never leaves
the device.

Success: user drags in any of the 8 example files (or explicit-watts
variants), types FTP/weight, and gets a trustworthy fittest-first route
list with time margins.

## 2. Inputs
- `.zwo` file (percent-FTP and explicit-watts, see §3).
- FTP (watts) + body weight (kg), typed each time. No saved profile v1.
- FreeRide assumption (%), default 70, editable.

## 3. ZWO parser (`zwo.js`)
- Supported segments: `Warmup`, `Cooldown`, `SteadyState`,
  `IntervalsT` (with `Repeat`), `Ramp`, `FreeRide`.
- Time-weighted average watts + total seconds + segment table.
- Power resolution per segment attribute:
  - numeric value > 2 → explicit watts (ignores FTP).
  - else → fraction × effective FTP.
  - file-level `ftpOverride` (if present) is the effective FTP for
    percent segments; explicit-watt segments unaffected.
- `Ramp` = linear mean of `PowerLow→PowerHigh`.
- `Warmup`/`Cooldown` = mean of `PowerLow`/`PowerHigh`.
- `FreeRide` (no target) = FreeRide% × FTP; UI badges any workout where
  FreeRide contributes >15% of duration (FTP-test files read low by
  design — the 20-min all-out block is ~100%, not 70% — and the UI says so).
- Verified against: 8 example files in
  `athlete-os/workouts/zwo/` (all percent-style, 0.40–1.10 range).

## 4. Physics model (`physics.js`)
- `w/kg = avgW / kg` → flat speed `v = k·(w/kg)^(1/3)` (aero-dominated
  cube-root model), `k` calibrated from mywhooshinfo sample times on
  Alula Adventure Loop 31.4 km / 332 m (1.6→21.8, 2.0→26.0, 3.0→32.4,
  3.2→34.8, 4.0→37.4 km/h).
- Climb penalty: divide by `1 + elevPerKm·c`, `c` fit from contrast
  pairs (flat Bruges 0.1 m/km vs Jebel Hafeet 44.5 m/km).
- Per-route output is a RANGE (model ±10%). A route "fits" iff the
  pessimistic end ≤ workout duration (no mid-route stranding).
- Constants live as named values in `physics.js` with source URLs in
  comments (mywhooshinfo.com route + sample-duration tables).

## 5. Route data (`routes.json` + refresh)
- Bundled `routes.json`: name, world, distance km, elevation m
  (mywhooshinfo.com list, ~120+ routes across Alula/Arabia/Australia/
  Belgium/Bhutan/California/Colombia/France/MyWhoosh World/etc.;
  full table saved 2026-09-26).
- Totals-only is enough for v1 (no per-point elevation profiles).
- Freshness: `scripts/refresh-routes` + `.github/workflows/refresh-routes.yml`
  (weekly re-scrape → commit). Rationale: mywhooshinfo currently echoes
  `Access-Control-Allow-Origin` (verified 2026-09-26), so direct browser
  live-scrape works TODAY — but it is accidental config, and phone-side
  scraping of 100+ pages is slow/rude/fragile. Static bundle + Action is
  the Pages-native pattern. If their HTML changes, only the scraper
  breaks, not the app.

## 6. UI (`index.html`)
- Inputs: FTP, weight, FreeRide% (default 70). Drag-and-drop `.zwo`.
- Workout summary line: total time, avg watts, FreeRide badge if applicable.
- Route list fittest-first: name, world, dist/elev, predicted time range,
  minutes to spare. Toggle "only show fits" (default ON) + "allow 5 min
  over" for close calls. Client-side only.

## 7. Architecture (static SPA, no build — Approach 1)
- `index.html`, `zwo.js`, `physics.js`, `routes.json`,
  `scripts/refresh-routes.*`, `.github/workflows/refresh-routes.yml`.
- No bundler, no deps, no server. Deploys to GitHub Pages as-is.
- Rejected: Vite+Vitest (build step buys nothing at this size);
  framework+live scraper (overkill; route list changes slowly).

## 8. Testing
- Parser: one case per segment type + percent-vs-watts boundary
  (2.0→percent, 2.1→watts) + `ftpOverride` + missing-Power FreeRide.
- Physics: model lands within ~10% of known sample times.
- Runner: `node --test` stdlib (zero deps).

## 9. Non-goals (v1)
- No saved rider profile, no login, no backend.
- No per-point elevation profiles / segment-level pacing.
- No Electron wrapper (user confirmed: no desktop need).
- No imperial/metric switch beyond km + minutes (Pages/phone first).

## 10. Open items for build plan
- Confirm weight unit (kg assumed) + default FreeRide% = 70.
- Refresh script language (node vs python) at plan time.
