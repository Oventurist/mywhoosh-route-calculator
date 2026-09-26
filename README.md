# MyWhoosh Route Calculator

Upload a cycling `.zwo` workout, enter your FTP + weight, and see which
MyWhoosh routes you can finish inside the workout time — predicted with a
simple physics model, not just duration matching.

## Use it

- **Hosted:** enable GitHub Pages (repo Settings → Pages → Deploy from
  branch, pick the branch and `/ (root)`), then open the Pages URL on your
  phone or laptop.
- **Locally:** serve the folder over HTTP and open it, e.g.
  `npx serve` (or `python -m http.server`). Opening `index.html` straight
  from disk does **not** work — browsers block the route-data load on
  `file://`, and the page will tell you so.

No build step, no dependencies, no server. Your `.zwo` never leaves the page.

## How it works

1. **Parse** — every segment (`Warmup`/`Cooldown`/`SteadyState`/
   `IntervalsT`/`Ramp`/`FreeRide`) becomes time + average watts. Power
   values above 2 mean explicit watts, anything at or below 2 means
   fraction of FTP. A file-level `ftpOverride` wins over typed FTP.
2. **Predict** — average watts + weight → w/kg → flat speed minus a
   climbing cost from the route's elevation. Calibrated against real
   MyWhoosh rider times; every prediction is a ±10% range, and a route
   only counts as fitting if the *pessimistic* end fits your workout.
3. **Rank** — fittest first (least spare time on top), with a toggle for
   close calls up to 5 minutes over.

## Know its limits

- **FreeRide blocks** (e.g. the 20-minute all-out in an FTP test) have no
  power target, so the app assumes your FreeRide % (default 70% FTP,
  editable). The page flags workouts where this matters. On an FTP test
  the estimate reads low — that's expected.
- **Predictions are estimates**, good to about ±10% on typical rolling
  courses. Very flat or very steep routes have less calibration behind
  them; the pessimistic fit rule is there for exactly that reason.

## Route data

`routes.json` (114 routes: name, world, distance, elevation) comes from
[mywhooshinfo.com/routes](https://mywhooshinfo.com/routes/) and is
re-scraped weekly by the `Refresh routes` Action
(`scripts/refresh-routes.mjs`). Run it by hand any time:

```sh
node scripts/refresh-routes.mjs            # rewrites routes.json
node scripts/refresh-routes.mjs --fixture tests/fixtures/routes-sample.html --out /tmp/check.json
```

## Develop

```sh
node --test tests/zwo.test.js tests/physics.test.js tests/routes.test.js tests/match.test.js tests/refresh.test.js
```
