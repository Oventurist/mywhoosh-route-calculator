// match.js — rank routes against a parsed workout. Pure function, no DOM.
import { estimateRouteTime } from './physics.js';

export function rankRoutes(
  { totalSeconds, avgWatts },
  routes,
  { weightKg, allowOverS = 0 } = {},
) {
  const rows = routes.map((route) => {
    const { lowS, midS, highS } = estimateRouteTime({
      avgWatts,
      weightKg,
      distanceKm: route.distanceKm,
      elevM: route.elevM,
    });
    const spareS = totalSeconds - highS;
    return { route, lowS, midS, highS, spareS, fits: spareS + allowOverS >= 0 };
  });
  rows.sort((a, b) => {
    if (a.fits !== b.fits) return a.fits ? -1 : 1;
    // Fits: tightest first. Unfit: closest near-miss first.
    return a.fits ? a.spareS - b.spareS : b.spareS - a.spareS;
  });
  return rows;
}
