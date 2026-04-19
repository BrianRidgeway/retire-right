import { describe, it, expect } from 'vitest';
import { runOptimizer } from '../engine/optimizer/combine';
import { makeDefaultScenario } from '../state/defaults';
import { Scenario } from '../types';

function fixedBirthYearScenario(): Scenario {
  const s = makeDefaultScenario();
  return {
    ...s,
    startYear: 2025,
    household: {
      ...s.household,
      primary: { ...s.household.primary, birthYear: 1965 },
      spouse: s.household.spouse ? { ...s.household.spouse, birthYear: 1967 } : undefined,
    },
  };
}

describe('runOptimizer', () => {
  it('returns baseline plus ranked alternatives', () => {
    const scenario = fixedBirthYearScenario();
    const results = runOptimizer(scenario);
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].strategy.label.toLowerCase()).toContain('do nothing');
    for (const r of results) {
      expect(r.results.length).toBeGreaterThan(0);
      expect(typeof r.score).toBe('number');
    }
  });

  it('at least one alternative scores >= baseline', () => {
    const scenario = fixedBirthYearScenario();
    const [baseline, ...alts] = runOptimizer(scenario);
    const bestAlt = alts.reduce((a, b) => (a.score >= b.score ? a : b));
    expect(bestAlt.score).toBeGreaterThanOrEqual(baseline.score);
  });

  it('finishes in under 15s on the default scenario', () => {
    const scenario = fixedBirthYearScenario();
    const t0 = Date.now();
    runOptimizer(scenario);
    const ms = Date.now() - t0;
    expect(ms).toBeLessThan(15000);
  }, 20000);
});
