import { describe, it, expect } from 'vitest';
import { runScenario } from '../engine/projection';
import { Scenario } from '../types';
import { makeDefaultScenario } from '../state/defaults';

function base(): Scenario {
  // Use a deterministic scenario with fixed birth years so age math doesn't drift year-over-year.
  const s = makeDefaultScenario();
  return {
    ...s,
    startYear: 2025,
    household: {
      ...s.household,
      primary: { ...s.household.primary, birthYear: 1965 },
      spouse: s.household.spouse ? { ...s.household.spouse, birthYear: 1967 } : undefined,
      planEndAge: 95,
    },
  };
}

describe('runScenario smoke test', () => {
  it('produces one YearResult per plan year through planEndAge', () => {
    const scenario = base();
    const results = runScenario(scenario);
    expect(results.length).toBeGreaterThan(30);
    expect(results[0].year).toBe(scenario.startYear);
    // last row: primary reaches planEndAge
    const last = results[results.length - 1];
    expect(last.primaryAge).toBeLessThanOrEqual(scenario.household.planEndAge);
  });

  it('RMDs kick in at applicable age', () => {
    const scenario = base();
    const results = runScenario(scenario);
    // Primary born 1965 → applicable age 75, start year 2025 → reaches 75 in 2040.
    const rmdStart = results.find((r) => r.primaryAge >= 75);
    expect(rmdStart).toBeDefined();
    expect(rmdStart!.rmdRequired).toBeGreaterThan(0);
    const preRmd = results.find((r) => r.primaryAge === 74);
    expect(preRmd?.rmdRequired ?? 0).toBe(0);
  });

  it('Social Security starts at claim age', () => {
    const scenario = base();
    const results = runScenario(scenario);
    const pre = results.find((r) => r.primaryAge === 66);
    const at = results.find((r) => r.primaryAge === 67);
    expect(pre?.socialSecurity ?? 0).toBe(0);
    expect(at?.socialSecurity ?? 0).toBeGreaterThan(0);
  });

  it('Net worth is positive at start', () => {
    const scenario = base();
    const results = runScenario(scenario);
    expect(results[0].netWorthEoy).toBeGreaterThan(0);
  });

  it('IRMAA surcharge appears once Medicare-eligible with high MAGI in Y-2', () => {
    const scenario = base();
    // Force MAGI high via a big one-off pension
    scenario.incomeStreams = [
      ...scenario.incomeStreams,
      {
        id: 'pension-big',
        label: 'Big pension',
        kind: 'pension',
        annualAmount: 300000,
        taxablePercent: 1,
        startYear: 2025,
        cola: 0,
      },
    ];
    const results = runScenario(scenario);
    // Primary reaches 65 in 2030; Y-2 MAGI from 2028 should be huge; by 2032 the history is populated.
    const postMedicareHighIrmaa = results.find((r) => r.primaryAge >= 67 && r.irmaaAnnual > 0);
    expect(postMedicareHighIrmaa).toBeDefined();
  });
});
