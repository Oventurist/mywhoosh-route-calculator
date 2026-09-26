import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateRouteTime, speedKmh } from '../physics.js';

// Alula Adventure Loop: 31.4 km, 332 m.
// mywhooshinfo.com sample times: 2.0 w/kg (176 W) → 1:12:34 = 4354 s;
// 3.0 w/kg (206 W) → 58:13 = 3493 s.
const ADVENTURE = { distanceKm: 31.4, elevM: 332 };

describe('estimateRouteTime', () => {
  it('calibration flat-ish', () => {
    const r = estimateRouteTime({ avgWatts: 150, weightKg: 75, ...ADVENTURE });
    assert.ok(
      Math.abs(r.midS - 4354) / 4354 < 0.1,
      `got midS=${r.midS}, want within 10% of 4354`,
    );
  });

  it('calibration strong rider', () => {
    const r = estimateRouteTime({ avgWatts: 225, weightKg: 75, ...ADVENTURE });
    assert.ok(
      Math.abs(r.midS - 3493) / 3493 < 0.1,
      `got midS=${r.midS}, want within 10% of 3493`,
    );
  });

  it('climbing penalty orders correctly', () => {
    const hafeet = estimateRouteTime({
      avgWatts: 150,
      weightKg: 75,
      distanceKm: 16.5,
      elevM: 735,
    });
    const bruges = estimateRouteTime({
      avgWatts: 150,
      weightKg: 75,
      distanceKm: 10.56,
      elevM: 1,
    });
    assert.ok(
      hafeet.midS / 16.5 > 3 * (bruges.midS / 10.56),
      `hafeet ${hafeet.midS / 16.5}s/km vs bruges ${bruges.midS / 10.56}s/km`,
    );
  });

  it('band is ±10%', () => {
    const r = estimateRouteTime({ avgWatts: 150, weightKg: 75, ...ADVENTURE });
    assert.ok(Math.abs(r.lowS - 0.9 * r.midS) <= 1, `lowS=${r.lowS}`);
    assert.ok(Math.abs(r.highS - 1.1 * r.midS) <= 1, `highS=${r.highS}`);
  });

  it('heavier rider at same watts is slower', () => {
    const light = estimateRouteTime({ avgWatts: 150, weightKg: 75, ...ADVENTURE });
    const heavy = estimateRouteTime({ avgWatts: 150, weightKg: 90, ...ADVENTURE });
    assert.ok(heavy.midS > light.midS, `${heavy.midS} vs ${light.midS}`);
  });

  it('speedKmh matches the time estimate', () => {
    const r = estimateRouteTime({ avgWatts: 150, weightKg: 75, ...ADVENTURE });
    const v = speedKmh({
      avgWatts: 150,
      weightKg: 75,
      elevPerKm: 332 / 31.4,
    });
    assert.ok(Math.abs((31.4 / v) * 3600 - r.midS) < 2, `v=${v}`);
  });
});
