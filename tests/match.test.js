import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rankRoutes } from '../match.js';
import { estimateRouteTime } from '../physics.js';

const ROUTE_A = { name: 'A', world: 'Test', distanceKm: 20, elevM: 100 };
const ROUTE_B = { name: 'B', world: 'Test', distanceKm: 10, elevM: 50 };
const ROUTE_C = { name: 'C', world: 'Test', distanceKm: 239.6, elevM: 8854 };

describe('rankRoutes', () => {
  it('fit rule', () => {
    const est = estimateRouteTime({
      avgWatts: 150,
      weightKg: 75,
      distanceKm: 20,
      elevM: 100,
    });
    const ok = rankRoutes(
      { totalSeconds: est.highS + 100, avgWatts: 150 },
      [ROUTE_A],
      { weightKg: 75, allowOverS: 0 },
    );
    assert.equal(ok[0].fits, true);
    const over = rankRoutes(
      { totalSeconds: est.highS - 100, avgWatts: 150 },
      [ROUTE_A],
      { weightKg: 75, allowOverS: 0 },
    );
    assert.equal(over[0].fits, false);
    const forgiven = rankRoutes(
      { totalSeconds: est.highS - 100, avgWatts: 150 },
      [ROUTE_A],
      { weightKg: 75, allowOverS: 300 },
    );
    assert.equal(forgiven[0].fits, true);
  });

  it('sort order', () => {
    const eA = estimateRouteTime({ avgWatts: 150, weightKg: 75, distanceKm: 20, elevM: 100 });
    // Total sits 60 s above A's pessimistic end; B (shorter) has more
    // spare; C (239 km) cannot fit.
    const total = eA.highS + 60;
    const rows = rankRoutes({ totalSeconds: total, avgWatts: 150 }, [ROUTE_C, ROUTE_B, ROUTE_A], {
      weightKg: 75,
      allowOverS: 0,
    });
    assert.deepEqual(
      rows.map((r) => r.route.name),
      ['A', 'B', 'C'],
    );
    assert.equal(rows[0].spareS, 60);
    assert.ok(rows[1].spareS > 60 && rows[1].fits);
    assert.equal(rows[2].fits, false);
  });

  it('spare uses pessimistic end', () => {
    const [row] = rankRoutes({ totalSeconds: 3600, avgWatts: 150 }, [ROUTE_A], {
      weightKg: 75,
      allowOverS: 0,
    });
    const est = estimateRouteTime({ avgWatts: 150, weightKg: 75, distanceKm: 20, elevM: 100 });
    assert.equal(row.spareS, 3600 - est.highS);
  });

  it('zero-distance route never yields NaN', () => {
    const [row] = rankRoutes(
      { totalSeconds: 3600, avgWatts: 150 },
      [{ name: 'Z', world: 'Test', distanceKm: 0, elevM: 0 }],
      { weightKg: 75, allowOverS: 0 },
    );
    assert.ok(Number.isFinite(row.spareS), `spareS=${row.spareS}`);
    assert.equal(row.fits, true);
  });
});
