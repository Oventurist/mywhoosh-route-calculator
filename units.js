// units.js — unit system conversions + user-facing formatting.
// Pure functions, no DOM; runs in browsers and under node --test unchanged.
// Internal physics stays metric; these convert at the display/input boundary.

export const LB_PER_KG = 2.20462;
export const MI_PER_KM = 0.621371;
export const FT_PER_M = 3.28084;

export function kgToLb(kg) {
  return kg * LB_PER_KG;
}

export function lbToKg(lb) {
  return lb / LB_PER_KG;
}

function trimNum(n, decimals) {
  return String(parseFloat(n.toFixed(decimals)));
}

export function formatDistance(distanceKm, system) {
  if (system === 'imperial') return `${trimNum(distanceKm * MI_PER_KM, 2)} mi`;
  return `${trimNum(distanceKm, 2)} km`;
}

export function formatElevation(elevM, system) {
  if (system === 'imperial') return `${Math.round(elevM * FT_PER_M)} ft`;
  return `${Math.round(elevM)} m`;
}
