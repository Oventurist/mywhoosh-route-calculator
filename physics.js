// physics.js — estimate MyWhoosh route times from workout-average power.
// Zero dependencies; runs in browsers and under node --test unchanged.
//
// Model: t = dist / v_flat + m·g·H / P
//   v_flat = A_FLAT · P^(1/3) ............ aero-dominated flat speed
//   m·g·H / P ............................ gravity work at constant power
// Predictions carry a ±10% band; callers fit against the pessimistic end.
//
// Calibration (mywhooshinfo.com Alula Adventure Loop page, 31.4 km / 332 m,
// "Sample durations" table):
//   1.6 w/kg,  95 W → 01:26:22 (5182 s); model 5477 s (+5.7%)
//   2.0 w/kg, 176 W → 01:12:34 (4354 s); model 4521 s at 150 W/75 kg (+3.8%)
//   3.0 w/kg, 206 W → 58:13    (3493 s); model 3576 s at 225 W/75 kg (+2.4%)
//   3.2 w/kg, 232 W → 54:10    (3250 s); model 3481 s (+7.1%)
//   4.0 w/kg, 297 W → 50:19    (3019 s); model 3067 s (+1.6%)
// All five sample points land within ~7%. A multiplicative climb factor
// was tried first and could not fit the 1.6 w/kg point (off 14%), so the
// additive gravity term stands.

export const A_FLAT = 2.174; // (m/s) per W^(1/3) — fit to the samples above
export const BIKE_KG = 8; // bike + kit allowance added to rider mass
export const GRAVITY = 9.81; // m/s^2
export const ETA = 1.0; // virtual drivetrain: nominal (no loss dial)
export const BAND = 0.1; // ±10% prediction band

export function flatSpeedMs(avgWatts) {
  if (!Number.isFinite(avgWatts) || avgWatts <= 0) return 0;
  return A_FLAT * Math.cbrt(avgWatts);
}

export function estimateRouteTime({ avgWatts, weightKg, distanceKm, elevM }) {
  const m = weightKg + BIKE_KG;
  const v = flatSpeedMs(avgWatts);
  if (!(v > 0) || !(m > 0) || !(distanceKm >= 0)) {
    return { lowS: Infinity, midS: Infinity, highS: Infinity };
  }
  const flatS = (distanceKm * 1000) / v;
  const climbS = (m * GRAVITY * Math.max(elevM, 0)) / (avgWatts * ETA);
  const midS = Math.round(flatS + climbS);
  return {
    lowS: Math.round(midS * (1 - BAND)),
    midS,
    highS: Math.round(midS * (1 + BAND)),
  };
}

// Effective average speed (km/h) over a route of given climbing intensity.
export function speedKmh({ avgWatts, weightKg, elevPerKm }) {
  const { midS } = estimateRouteTime({
    avgWatts,
    weightKg,
    distanceKm: 1,
    elevM: Math.max(elevPerKm, 0),
  });
  if (!Number.isFinite(midS) || midS <= 0) return 0;
  return 3600 / midS;
}
