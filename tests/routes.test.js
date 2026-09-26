import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const routes = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'routes.json'),
    'utf8',
  ),
);

describe('routes', () => {
  it('has 100+ routes with valid shape', () => {
    assert.ok(routes.length >= 100, `got ${routes.length}`);
    for (const r of routes) {
      assert.ok(typeof r.name === 'string' && r.name.length > 0, JSON.stringify(r));
      assert.ok(typeof r.world === 'string' && r.world.length > 0, JSON.stringify(r));
      assert.ok(typeof r.distanceKm === 'number' && r.distanceKm > 0, JSON.stringify(r));
      assert.ok(typeof r.elevM === 'number' && r.elevM >= 0, JSON.stringify(r));
    }
  });

  it('spot-checks known routes', () => {
    const byName = Object.fromEntries(routes.map((r) => [r.name, r]));
    assert.deepEqual(
      [byName['Alula Adventure Loop'].distanceKm, byName['Alula Adventure Loop'].elevM],
      [31.4, 332],
    );
    assert.deepEqual(
      [byName['Jabel Hafeet'].distanceKm, byName['Jabel Hafeet'].elevM],
      [16.5, 735],
    );
    assert.deepEqual(
      [byName['Bruges'].distanceKm, byName['Bruges'].elevM],
      [10.56, 1],
    );
  });
});
