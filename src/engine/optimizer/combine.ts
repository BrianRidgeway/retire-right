import { Scenario, Strategy, StrategyResult, SurvivorEvent } from '../../types';
import { runScenario } from '../projection';
import { baselineScenario, scoreResults } from './score';
import { optimizeRothLadder } from './rothLadder';
import { optimizeSsClaim } from './ssClaim';
import { optimizeWithdrawOrder } from './withdrawOrder';
import { describeActions, describeRationale } from './explain';
import { scenarioConcerns, strategyConcerns } from './concerns';
import { heirNetFromBalances } from '../heir';

const SENSITIVITY_RATES = [0.22, 0.24, 0.32, 0.35] as const;

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
  const sharedConcerns = scenarioConcerns(scenario);
  const defaultSurvivor = defaultSurvivorEvent(scenario);

  for (const r of all) {
    r.pros = [];
    r.cons = [];
    r.actions = describeActions(scenario, r.strategy);
    r.rationale = describeRationale(r, baseline);
    r.concerns = [...sharedConcerns, ...strategyConcerns(scenario, r.results, r.strategy)];

    // Survivor projection: run the same strategy under a survivor event (older spouse dies at 85)
    if (defaultSurvivor) {
      const survivorScenario: Scenario = { ...scenario, strategy: r.strategy, survivorEvent: defaultSurvivor };
      const survivorResults = runScenario(survivorScenario);
      const last = survivorResults[survivorResults.length - 1];
      const lifetimeTax = survivorResults.reduce((s, y) => s + y.totalTax, 0);
      const anyShortfall = survivorResults.some((y) => y.cashShortfall > 0);
      const decedent =
        scenario.household.primary.id === defaultSurvivor.decedentId
          ? scenario.household.primary
          : scenario.household.spouse!;
      r.survivor = {
        deathYear: defaultSurvivor.year,
        decedentName: decedent.name,
        lifetimeTax,
        endingNetWorth: last ? last.netWorthEoy : 0,
        endingHeirNetWorth: last ? last.heirNetWorthEoy : 0,
        anyShortfall,
      };
    }

    // LTC stress projection: one spouse needs 3 years of paid care at age 80
    const ltcStress = runLtcStress(scenario, r.strategy);
    if (ltcStress) {
      r.ltcStress = {
        ...ltcStress,
        stressInducedShortfall: !r.anyShortfall && ltcStress.anyShortfall,
      };
    }

    if (r === baseline) {
      r.pros.push('No action required - simplest possible plan.');
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
  const last = results[results.length - 1];
  const heirSensitivity = last
    ? SENSITIVITY_RATES.map((rate) => ({
        rate,
        endingHeirNetWorth: heirNetFromBalances(last.balancesEoy, scenario.accounts, rate),
      }))
    : [];
  return {
    strategy: scenario.strategy,
    results,
    score: score.score,
    lifetimeAfterTax: score.lifetimeAfterTax,
    lifetimeTax: score.lifetimeTax,
    endingNetWorth: score.endingNetWorth,
    endingHeirNetWorth: score.endingHeirNetWorth,
    heirSensitivity,
    anyShortfall: score.anyShortfall,
    actions: [],
    rationale: '',
    pros: [],
    cons: [],
    concerns: [],
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

const LTC_ANNUAL_COST_TODAY = 140_000; // typical MD facility/home-care cost, 2025
const LTC_MEDICAL_INFLATION = 0.05;
const LTC_DURATION_YEARS = 3;
const LTC_TRIGGER_AGE = 80;

/**
 * Run the LTC stress scenario: one spouse needs LTC_DURATION_YEARS years of paid care starting
 * the year they turn LTC_TRIGGER_AGE. Cost is LTC_ANNUAL_COST_TODAY indexed at LTC_MEDICAL_INFLATION
 * from plan start year. We model this by injecting one-off spending in those years; everything
 * else (taxes, withdrawals, RMDs) flows through the standard projection.
 *
 * Returns the ending wealth impact and whether the plan fails under stress. Returns undefined if
 * no spouse is alive at the trigger age (single household where primary is already past 80, etc).
 */
function runLtcStress(scenario: Scenario, strategy: Strategy): {
  startYear: number;
  totalCostNominal: number;
  endingNetWorth: number;
  endingHeirNetWorth: number;
  anyShortfall: boolean;
} | undefined {
  // Pick the older spouse (or the only person if single)
  const candidate = scenario.household.spouse
    ? (scenario.household.primary.birthYear <= scenario.household.spouse.birthYear
        ? scenario.household.primary
        : scenario.household.spouse)
    : scenario.household.primary;
  const startYear = candidate.birthYear + LTC_TRIGGER_AGE;
  if (startYear < scenario.startYear) return undefined;

  const yearsFromStart = startYear - scenario.startYear;
  const baseCostAtStress = LTC_ANNUAL_COST_TODAY * Math.pow(1 + LTC_MEDICAL_INFLATION, yearsFromStart);

  const ltcOneOffs = Array.from({ length: LTC_DURATION_YEARS }, (_, i) => ({
    year: startYear + i,
    amount: baseCostAtStress * Math.pow(1 + LTC_MEDICAL_INFLATION, i),
  }));
  const totalCostNominal = ltcOneOffs.reduce((s, o) => s + o.amount, 0);

  const stressedScenario: Scenario = {
    ...scenario,
    strategy,
    spending: {
      ...scenario.spending,
      oneOffs: [...scenario.spending.oneOffs, ...ltcOneOffs],
    },
  };
  const results = runScenario(stressedScenario);
  const last = results[results.length - 1];
  const anyShortfall = results.some((y) => y.cashShortfall > 0);
  return {
    startYear,
    totalCostNominal,
    endingNetWorth: last ? last.netWorthEoy : 0,
    endingHeirNetWorth: last ? last.heirNetWorthEoy : 0,
    anyShortfall,
  };
}

/**
 * Default survivor event for a two-person household: the older spouse dies at age 85.
 * Returns undefined for single households (no widow's-penalty scenario applicable).
 */
function defaultSurvivorEvent(scenario: Scenario): SurvivorEvent | undefined {
  if (!scenario.household.spouse) return undefined;
  const p = scenario.household.primary;
  const s = scenario.household.spouse;
  const decedent = p.birthYear <= s.birthYear ? p : s; // older
  const deathYear = decedent.birthYear + 85;
  // Don't model survivor scenario if death year is before plan start
  if (deathYear < scenario.startYear) return undefined;
  return { year: deathYear, decedentId: decedent.id };
}
