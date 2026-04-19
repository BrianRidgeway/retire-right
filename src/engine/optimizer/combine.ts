import { Scenario, Strategy, StrategyResult } from '../../types';
import { runScenario } from '../projection';
import { baselineScenario, scoreResults } from './score';
import { optimizeRothLadder } from './rothLadder';
import { optimizeSsClaim } from './ssClaim';
import { optimizeWithdrawOrder } from './withdrawOrder';
import { describeActions, describeRationale } from './explain';

/**
 * Coordinate-descent: optimize SS claim age, then withdrawal policy, then Roth ladder.
 * Iterate until score stops improving. Returns top strategies (baseline + variants).
 */
export function runOptimizer(scenario: Scenario): StrategyResult[] {
  const baseline = evaluate(baselineScenario(scenario));

  // Variant 1: full coordinated optimization
  let strat: Strategy = {
    rothConversions: {},
    withdrawalPolicy: 'conventional',
    ssClaimAges: {},
    label: 'Fully optimized',
  };
  let prevScore = -Infinity;
  for (let i = 0; i < 3; i++) {
    strat = optimizeSsClaim(scenario, strat);
    strat = optimizeWithdrawOrder(scenario, strat);
    strat = optimizeRothLadder(scenario, strat);
    const score = scoreOf(scenario, strat);
    if (score - prevScore < 100) break;
    prevScore = score;
  }
  const fullyOptimized = evaluate({ ...scenario, strategy: { ...strat, label: 'Fully optimized' } });

  // Variant 2: Roth-heavy (aggressive conversions)
  const rothHeavyStrat: Strategy = optimizeRothLadder(scenario, {
    rothConversions: {},
    withdrawalPolicy: 'conventional',
    ssClaimAges: {},
    label: 'Roth ladder',
  });
  const rothHeavy = evaluate({ ...scenario, strategy: { ...rothHeavyStrat, label: 'Roth ladder focus' } });

  // Variant 3: Delay SS only (no conversions)
  const delaySs: Strategy = optimizeSsClaim(scenario, {
    rothConversions: {},
    withdrawalPolicy: 'conventional',
    ssClaimAges: {},
    label: 'Delay SS',
  });
  const ssScenario = applyClaimAges(scenario, delaySs);
  const delaySsResult = evaluate({ ...ssScenario, strategy: { ...delaySs, label: 'Delay SS to 70' } });

  const all = [baseline, fullyOptimized, rothHeavy, delaySsResult];

  for (const r of all) {
    r.pros = [];
    r.cons = [];
    r.actions = describeActions(scenario, r.strategy);
    r.rationale = describeRationale(r, baseline);

    if (r === baseline) {
      r.pros.push('No action required — simplest possible plan.');
      continue;
    }
    const dAfterTax = r.lifetimeAfterTax - baseline.lifetimeAfterTax;
    const dTax = r.lifetimeTax - baseline.lifetimeTax;
    const dEnding = r.endingNetWorth - baseline.endingNetWorth;
    if (dAfterTax > 1000) r.pros.push(`+$${fmt(dAfterTax)} lifetime spending covered vs do-nothing.`);
    if (dEnding > 1000) r.pros.push(`+$${fmt(dEnding)} ending net worth vs do-nothing.`);
    if (dTax < -1000) r.pros.push(`$${fmt(-dTax)} less total tax paid vs do-nothing.`);
    if (dAfterTax < -1000) r.cons.push(`$${fmt(-dAfterTax)} less lifetime spending covered vs do-nothing.`);
    if (dEnding < -1000) r.cons.push(`$${fmt(-dEnding)} less ending net worth vs do-nothing.`);
    if (dTax > 1000) r.cons.push(`+$${fmt(dTax)} more total tax paid over lifetime.`);
    if (r.anyShortfall && !baseline.anyShortfall) r.cons.push('Runs out of money in at least one year.');
    if (!r.anyShortfall && baseline.anyShortfall) r.pros.push('Avoids running out of money.');
  }

  // Sort: baseline stays first for reference, then by score descending.
  const sorted = [baseline, ...all.filter((r) => r !== baseline).sort((a, b) => b.score - a.score)];
  return sorted;
}

function scoreOf(scenario: Scenario, strategy: Strategy): number {
  return scoreResults({
    results: runScenario({ ...scenario, strategy }),
    discountRate: scenario.assumptions.discountRate,
    startYear: scenario.startYear,
  }).score;
}

function evaluate(scenario: Scenario): StrategyResult {
  const results = runScenario(scenario);
  const score = scoreResults({
    results,
    discountRate: scenario.assumptions.discountRate,
    startYear: scenario.startYear,
  });
  return {
    strategy: scenario.strategy,
    results,
    score: score.score,
    lifetimeAfterTax: score.lifetimeAfterTax,
    lifetimeTax: score.lifetimeTax,
    endingNetWorth: score.endingNetWorth,
    endingHeirNetWorth: score.endingHeirNetWorth,
    anyShortfall: score.anyShortfall,
    actions: [],
    rationale: '',
    pros: [],
    cons: [],
  };
}

function applyClaimAges(scenario: Scenario, strategy: Strategy): Scenario {
  const primaryId = scenario.household.primary.id;
  const spouseId = scenario.household.spouse?.id;
  const primaryClaim = strategy.ssClaimAges[primaryId];
  const spouseClaim = spouseId ? strategy.ssClaimAges[spouseId] : undefined;
  return {
    ...scenario,
    household: {
      ...scenario.household,
      primary: primaryClaim != null ? { ...scenario.household.primary, ssClaimAge: primaryClaim } : scenario.household.primary,
      spouse:
        scenario.household.spouse && spouseClaim != null
          ? { ...scenario.household.spouse, ssClaimAge: spouseClaim }
          : scenario.household.spouse,
    },
  };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
