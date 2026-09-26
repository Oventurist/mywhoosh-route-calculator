import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRoutesHtml } from '../scripts/parse-routes.mjs';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('parseRoutesHtml', () => {
  it('parses table rows including thousand-spaced elevation', () => {
    const html = readFileSync(join(fixtureDir, 'routes-sample.html'), 'utf8');
    assert.deepEqual(parseRoutesHtml(html), [
      { name: 'Alula Adventure Loop', world: 'Alula', distanceKm: 31.4, elevM: 332 },
      { name: 'Arabian Knights', world: 'Arabia', distanceKm: 100, elevM: 1936 },
      { name: 'Bruges', world: 'Belgium', distanceKm: 10.56, elevM: 1 },
    ]);
  });
});
