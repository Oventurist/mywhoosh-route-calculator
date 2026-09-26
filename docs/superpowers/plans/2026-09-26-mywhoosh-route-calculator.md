# MyWhoosh Route Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static webapp where a user drops in a `.zwo`, types FTP + weight, and gets a fittest-first list of MyWhoosh routes that fit the workout time.

**Architecture:** Zero-dependency static SPA. Pure-logic ES modules (`zwo.js`, `physics.js`, `match.js`) tested with stdlib `node --test`; thin DOM glue in `app.js`/`index.html`; committed `routes.json` (112 routes) refreshed by a weekly Action.

**Tech Stack:** Vanilla JS (ES modules), `node --test` (Node 26, verified on host), GitHub Pages, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-26-mywhoosh-route-calculator-design.md`

## Global Constraints

- No bundler, no npm dependencies, no server, no secrets — Pages serves static files only.
- Power rule: segment value > 2 = explicit watts, else fraction × effective FTP; file `ftpOverride` wins for percent segments only.
- `FreeRide` watts = FreeRide% × FTP (default 70); badge workouts with FreeRide > 15% of duration.
- A route "fits" iff pessimistic estimate ≤ workout duration (+5 min only when the over-toggle is on).
- Fittest-first = smallest non-negative spare time first; predictions shown as ranges (model ±10%).
- Every task ends in a commit; TDD — failing test before implementation.

## Review Focus

- Malformed XML / non-`.zwo` file dropped in → clear error, no blank page (pinned in Task 4).
- `IntervalsT` with `Repeat="0"` or missing `Repeat` → treated as 1 repeat, not zeroed workout (pinned in Task 1).
- Segments missing `Duration` → segment skipped with console warning, totals still computed (pinned in Task 1).
- FTP or weight empty/zero/negative → inline validation, no Infinity/NaN in output (pinned in Task 4).
- Workout that is 100% FreeRide (e.g. just a FreeRide block) → result labeled estimate-from-assumption, not presented as measured (pinned in Task 4).

---

### Task 1: ZWO parser

**Files:**
- Create: `zwo.js`
- Create: `tests/zwo.test.js`
- Fixture (workspace only, not committed): copies of the 8 example files from `C:/Users/14053/hermes-projects/athlete-os/workouts/zwo/`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `parseZwo(xmlString, { ftp, freeridePct }) -> { name, totalSeconds, avgWatts, freerideSeconds, segments: [{ type, seconds, watts }] }` — `watts` per segment is the resolved target (time-weighted into `avgWatts`); `ftp` is effective FTP after `ftpOverride`.

- [ ] **Step 1: Write failing tests in `tests/zwo.test.js`** (import `node:test` + `node:assert/strict`, import `../zwo.js`):
  - `parses SteadyState percent`: `<SteadyState Duration="600" Power="0.95"/>` at ftp 200 → 600 s @ 190 W.
  - `parses explicit watts`: `<SteadyState Duration="300" Power="220"/>` at ftp 200 → 300 s @ 220 W (boundary: `Power="2.0"` → percent, `Power="2.1"` → watts).
  - `averages Warmup/Cooldown ends`: `<Warmup Duration="600" PowerLow="0.45" PowerHigh="0.65"/>` at ftp 200 → 600 s @ 110 W.
  - `expands IntervalsT repeats`: `<IntervalsT Repeat="2" OnDuration="60" OffDuration="60" OnPower="0.8" OffPower="0.5"/>` → 240 s total, avg 0.65 × ftp.
  - `missing Repeat defaults to 1`: same tag without `Repeat` → 120 s total.
  - `averages Ramp endpoints`: `<Ramp Duration="300" PowerLow="0.5" PowerHigh="1.0"/>` → 300 s @ 0.75 × ftp.
  - `FreeRide uses assumption`: `<FreeRide Duration="300"/>` with freeridePct 70, ftp 200 → 300 s @ 140 W.
  - `ftpOverride wins`: file with `<ftpOverride>250</ftpOverride>` (or attribute form) + percent segment at passed ftp 200 → uses 250.
  - `real file totals`: the 8 example files → totalSeconds `[2760, 5400, 2700, 4200, 3900, 4140, 3600, 5400]` in alphabetical filename order.
  - `real file avg`: `z2_endurance_60min.zwo` at ftp 156 → avgWatts within 0.5 W of 96.5.
- [ ] **Step 2: Run to verify they fail.** Run: `node --test tests/zwo.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `parseZwo` in `zwo.js`.** Regex-based attribute parsing (the format is flat — `<workout>` children with attributes only; ignore nested `<textevent>` children), NOT `DOMParser`, so the same module runs in browsers and under `node --test` with zero dependencies. `IntervalsT` missing/zero `Repeat` → 1. Segments without `Duration` are skipped. `> 2` → watts else fraction.
- [ ] **Step 4: Run tests to verify they pass.** Run: `node --test tests/zwo.test.js`. Expected: PASS, 10/10.
- [ ] **Step 5: Commit.** `git add zwo.js tests/zwo.test.js && git commit -m "feat: add ZWO parser with percent/watts support"`

### Task 2: Physics model

**Files:**
- Create: `physics.js`
- Create: `tests/physics.test.js`

**Interfaces:**
- Consumes: `avgWatts` from Task 1's `parseZwo`.
- Produces: `estimateRouteTime({ avgWatts, weightKg, distanceKm, elevM }) -> { lowS, midS, highS }` (±10% band around mid); `speedKmh({ avgWatts, weightKg, elevPerKm }) -> Number`; constants `FLAT_K`, `CLIMB_C` exported for inspection.

- [ ] **Step 1: Write failing tests in `tests/physics.test.js`:**
  - `calibration flat-ish`: Adventure Loop (31.4 km, 332 m) at 2.0 w/kg (150 W / 75 kg) → `midS` within 10% of 4354 (1:12:34 sample).
  - `calibration strong rider`: same route at 3.0 w/kg (225 W / 75 kg) → `midS` within 10% of 3493 (58:13 sample).
  - `climbing penalty orders correctly`: same watts/kg, Jebel Hafeet (16.5 km, 735 m) midS > 3× Bruges (10.56 km, 1 m) midS per-km pace (i.e. `midS/16.5 > 3 × midS/10.56`).
  - `band is ±10%`: `lowS ≈ 0.9 × midS`, `highS ≈ 1.1 × midS` (1 s tolerance).
  - `heavier rider at same watts is slower`: 150 W/90 kg midS > 150 W/75 kg midS on Adventure Loop.
- [ ] **Step 2: Run to verify they fail.** Run: `node --test tests/physics.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement in `physics.js`.** `v = FLAT_K·(w/kg)^(1/3)` flat speed, divide by `1 + elevPerKm·CLIMB_C`; fit `FLAT_K` from the 2.0 w/kg → 26.0 km/h point (`FLAT_K = 26.0 / 2^(1/3)` ≈ 20.64), choose `CLIMB_C` ≈ 0.02 and adjust until calibration tests pass. Comment every constant with its source URL.
- [ ] **Step 4: Run tests to verify they pass.** Run: `node --test tests/`. Expected: PASS (Tasks 1–2).
- [ ] **Step 5: Commit.** `git add physics.js tests/physics.test.js && git commit -m "feat: add w/kg physics model calibrated to sample times"`

### Task 3: Route dataset

**Files:**
- Create: `routes.json`
- Create: `tests/routes.test.js`

**Interfaces:**
- Consumes: nothing code-wise (data from 2026-09-26 mywhooshinfo scrape: 112 routes).
- Produces: `routes.json` — array of `{ name, world, distanceKm, elevM }`; consumed by Task 4.

- [ ] **Step 1: Write failing test in `tests/routes.test.js`:** loads `routes.json`; asserts length ≥ 100; every entry has non-empty `name`/`world`, `distanceKm` > 0, `elevM` ≥ 0; spot-checks Adventure Loop (31.4/332), Jebel Hafeet (16.5/735), Bruges (10.56/1).
- [ ] **Step 2: Run to verify it fails.** Run: `node --test tests/routes.test.js`. Expected: FAIL (file missing).
- [ ] **Step 3: Create `routes.json`.** Transcribe all 112 rows from the scrape cache (`Alula` 8 … `UCI 2025` 3 — full table in the saved page }): strip thousand-spaces in elevation (`1 936` → 1936), keep one decimal on distance. Add top-of-file `_source` + `_scraped` fields? No — keep the JSON a pure array (scraper metadata lives in Task 5); put source note in README instead.
- [ ] **Step 4: Run to verify it passes.** Run: `node --test tests/`. Expected: PASS (Tasks 1–3).
- [ ] **Step 5: Commit.** `git add routes.json tests/routes.test.js && git commit -m "data: add 112 MyWhoosh routes from mywhooshinfo"`

### Task 4: Matching logic + UI

**Files:**
- Create: `match.js`
- Create: `tests/match.test.js`
- Create: `index.html`
- Create: `app.js`

**Interfaces:**
- Consumes: `parseZwo` (Task 1), `estimateRouteTime` (Task 2), `routes.json` (Task 3).
- Produces: `rankRoutes({ totalSeconds, avgWatts, freerideSeconds }, routes, { weightKg, allowOverS }) -> [{ route, midS, lowS, highS, spareS, fits }]` sorted tightest-fit first (smallest non-negative `spareS`; unfit at end). UI: `app.js` wires inputs + drag-drop to `rankRoutes` and renders the list.

- [ ] **Step 1: Write failing tests in `tests/match.test.js`:**
  - `fit rule`: 3600 s workout, route pessimistic 3500 → fits; pessimistic 3700 → unfit; with allowOverS 300 → fits.
  - `sort order`: three routes with spare 60/600/unfit → ordered [60, 600, unfit].
  - `spare uses pessimistic end`: spareS === totalSeconds − highS.
  - `Repeat default + missing Duration` covered in Task 1; here: `rankRoutes` never returns NaN spareS for zero-distance route (0 km → midS 0, fits).
- [ ] **Step 2: Run to verify they fail.** Run: `node --test tests/match.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `match.js`.** Pure function, no DOM. `spareS = totalSeconds − highS`; `fits = spareS + allowOverS ≥ 0`.
- [ ] **Step 4: Build `index.html` + `app.js`.** Inputs: FTP (default 156), weight kg (blank, required), FreeRide% (default 70); drag-and-drop + file picker for `.zwo`; summary line (total time, avg watts, FreeRide badge when freerideSeconds > 15%); toggles "only show fits" (default on) + "allow 5 min over". Behaviors: malformed XML → red inline error, previous results stay; empty/zero/negative FTP/weight → inline validation, no compute; 100%-FreeRide workout → amber "estimate from assumption" label. Phone-usable layout (single column, ≥44 px targets), no CSS framework.
- [ ] **Step 5: Verify.** Run: `node --test tests/` → PASS. Manual: open `index.html`, drop in `z2_endurance_60min.zwo` (FTP 156) → summary shows 60:00 ≈ 96.5 W; drop `ftp-test-20min.zwo` → FreeRide badge appears; drop a `.txt` → clean error. (Executor: use `browser_navigate` to the local file or report the manual pass.)
- [ ] **Step 6: Commit.** `git add match.js tests/match.test.js index.html app.js && git commit -m "feat: add route matching and web UI"`

### Task 5: Refresh automation + Pages deploy

**Files:**
- Create: `scripts/refresh-routes.mjs`
- Create: `tests/refresh.test.js`
- Create: `.github/workflows/refresh-routes.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: `routes.json` schema from Task 3.
- Produces: weekly-fresh `routes.json`; live GitHub Pages site.

- [ ] **Step 1: Write failing test in `tests/refresh.test.js`:** fixture = 3-row HTML table snippet saved as `tests/fixtures/routes-sample.html`; assert the parser helper `parseRoutesHtml(html)` (exported from the script or a `scripts/parse-routes.js` module it imports) returns the 3 expected `{ name, world, distanceKm, elevM }` objects including a thousand-spaced elevation.
- [ ] **Step 2: Run to verify it fails.** Run: `node --test tests/refresh.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `scripts/refresh-routes.mjs`.** Fetches `https://mywhooshinfo.com/routes/`, parses the table with regex (same flat-HTML reasoning as Task 1 — no dependencies), writes `routes.json` (pure array, same schema). `--fixture <path>` flag reads local HTML instead of network (for tests/offline).
- [ ] **Step 4: Add `.github/workflows/refresh-routes.yml`.** Weekly cron + manual dispatch: run script, commit `routes.json` if changed (`git diff --quiet || git commit`). Add `README.md`: what the app is, how to run locally (open `index.html` / `npx serve`), how Pages is enabled (Settings → Pages → Deploy from branch), data source + refresh cadence, and the FreeRide/physics caveats in plain language.
- [ ] **Step 5: Verify.** Run: `node --test tests/` → PASS (all 5 suites); `node scripts/refresh-routes.mjs --fixture tests/fixtures/routes-sample.html` writes expected JSON to a temp path.
- [ ] **Step 6: Commit.** `git add scripts .github tests/refresh.test.js tests/fixtures README.md && git commit -m "chore: add route refresh automation and Pages docs"`
