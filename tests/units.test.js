import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  kgToLb,
  lbToKg,
  formatDistance,
  formatElevation,
} from '../units.js';

describe('weight conversion', () => {
  it('converts kg to lb', () => {
    assert.ok(Math.abs(kgToLb(75) - 165.347) < 0.01, `got ${kgToLb(75)}`);
  });

  it('converts lb to kg and round-trips', () => {
    assert.ok(Math.abs(lbToKg(165) - 74.843) < 0.01, `got ${lbToKg(165)}`);
    assert.ok(Math.abs(lbToKg(kgToLb(75)) - 75) < 1e-9, 'round-trip');
  });
});

describe('formatDistance', () => {
  it('metric shows km as-is', () => {
    assert.equal(formatDistance(31.4, 'metric'), '31.4 km');
  });

  it('imperial converts km to mi', () => {
    assert.equal(formatDistance(31.4, 'imperial'), '19.51 mi');
  });
});

describe('formatElevation', () => {
  it('metric shows m as-is', () => {
    assert.equal(formatElevation(332, 'metric'), '332 m');
  });

  it('imperial converts m to ft', () => {
    assert.equal(formatElevation(332, 'imperial'), '1089 ft');
  });
});
