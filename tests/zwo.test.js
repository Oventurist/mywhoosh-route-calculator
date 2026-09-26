import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseZwo } from '../zwo.js';

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
);

const wrap = (inner, name = 'Test') =>
  `<?xml version="1.0" encoding="UTF-8"?><workout_file>` +
  `<author>T</author><name>${name}</name><sportType>bike</sportType>` +
  `<workout>${inner}</workout></workout_file>`;

describe('parseZwo', () => {
  it('parses SteadyState percent', () => {
    const r = parseZwo(wrap('<SteadyState Duration="600" Power="0.95"/>'), {
      ftp: 200,
    });
    assert.equal(r.totalSeconds, 600);
    assert.equal(r.avgWatts, 190);
  });

  it('parses explicit watts', () => {
    const r = parseZwo(wrap('<SteadyState Duration="300" Power="220"/>'), {
      ftp: 200,
    });
    assert.equal(r.totalSeconds, 300);
    assert.equal(r.avgWatts, 220);
  });

  it('treats 2.0 as percent and 2.1 as watts', () => {
    const pct = parseZwo(wrap('<SteadyState Duration="60" Power="2.0"/>'), {
      ftp: 200,
    });
    const watts = parseZwo(wrap('<SteadyState Duration="60" Power="2.1"/>'), {
      ftp: 200,
    });
    assert.equal(pct.avgWatts, 400);
    assert.equal(watts.avgWatts, 2.1);
  });

  it('averages Warmup/Cooldown ends', () => {
    const r = parseZwo(
      wrap('<Warmup Duration="600" PowerLow="0.45" PowerHigh="0.65"/>'),
      { ftp: 200 },
    );
    assert.equal(r.totalSeconds, 600);
    assert.equal(r.avgWatts, 110);
  });

  it('expands IntervalsT repeats', () => {
    const r = parseZwo(
      wrap(
        '<IntervalsT Repeat="2" OnDuration="60" OffDuration="60" OnPower="0.8" OffPower="0.5"/>',
      ),
      { ftp: 200 },
    );
    assert.equal(r.totalSeconds, 240);
    assert.equal(r.avgWatts, 130);
  });

  it('missing Repeat defaults to 1', () => {
    const r = parseZwo(
      wrap(
        '<IntervalsT OnDuration="60" OffDuration="60" OnPower="0.8" OffPower="0.5"/>',
      ),
      { ftp: 200 },
    );
    assert.equal(r.totalSeconds, 120);
  });

  it('averages Ramp endpoints', () => {
    const r = parseZwo(
      wrap('<Ramp Duration="300" PowerLow="0.5" PowerHigh="1.0"/>'),
      { ftp: 200 },
    );
    assert.equal(r.totalSeconds, 300);
    assert.equal(r.avgWatts, 150);
  });

  it('FreeRide uses assumption', () => {
    const r = parseZwo(wrap('<FreeRide Duration="300"/>'), {
      ftp: 200,
      freeridePct: 70,
    });
    assert.equal(r.totalSeconds, 300);
    assert.equal(r.avgWatts, 140);
    assert.equal(r.freerideSeconds, 300);
  });

  it('ftpOverride wins', () => {
    const xml =
      `<?xml version="1.0"?><workout_file><name>T</name>` +
      `<ftpOverride>250</ftpOverride><workout>` +
      `<SteadyState Duration="60" Power="1.0"/></workout></workout_file>`;
    const r = parseZwo(xml, { ftp: 200 });
    assert.equal(r.avgWatts, 250);
  });

  it('real file totals', () => {
    const files = readdirSync(fixtureDir).sort();
    assert.equal(files.length, 8);
    const totals = files.map(
      (f) => parseZwo(readFileSync(join(fixtureDir, f), 'utf8'), { ftp: 156 }).totalSeconds,
    );
    assert.deepEqual(totals, [2760, 2700, 5400, 4200, 3600, 4140, 3600, 5400]);
  });

  it('real file avg', () => {
    const xml = readFileSync(join(fixtureDir, 'z2_endurance_60min.zwo'), 'utf8');
    const r = parseZwo(xml, { ftp: 156 });
    assert.ok(Math.abs(r.avgWatts - 96.5) < 0.5, `got ${r.avgWatts}`);
  });

  it('throws without ftp', () => {
    assert.throws(
      () => parseZwo(wrap('<SteadyState Duration="60" Power="0.9"/>'), {}),
      /ftp/,
    );
  });
});
