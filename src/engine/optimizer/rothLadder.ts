import { Scenario, Strategy, YearResult } from '../../types';
import { IRMAA, federalTableForYear } from '../tables';
import { runScenario } from '../projection';
import { scoreResults } from './score';
import { obbbaSeniorBonus, standardDeduction } from '../tax/federal';
import { isTraditional } from '../accounts';

/**
 * Roth conversion optimizer. Two layers:
 *
 *   1. Greedy per-year ceiling-targeting. For each candidate year, compute the year's baseline AGI
 *      (with this year's conversion forced to 0 but all other years' conversions held). Then probe
 *      AGI ceilings derived from federal bracket tops and IRMAA tier ceilings (the latter offset
 *      $2,000 below the cliff so we don't accidentally tip into the next surcharge tier). The
 *      conversion amount for each probe is max(0, ceilingAGI - baselineAGI) capped by available
 *      traditional balance for the primary owner.
 *
 *   2. Smoothing post-pass. After the greedy schedule converges, take any year whose conversion is
 *      substantially heavier than the schedule mean and try redistributing it forward 1–4 years.
 *      Keep the smoothed schedule iff it scores strictly better. This implements the rule "default to
 *      spreading conversions across multiple years rather than single-year bangs unless the multi-year
 *      net cost is provably higher."
 *
 * Unlike the prior implementation, this one:
 *   - Treats bracket/IRMAA tops as AGI *ceilings*, not raw conversion amounts.
 *   - Allows conversions past RMD age (stacked on top of the year's RMD income, which the projection
 *     handles via convertTraditionalToRoth → ordinaryIncome).
 *   - Stops 2K below each IRMAA cliff.
 *   - Verifies multi-year spread is not worse than single-year before recommending a bang.
 */

const IRMAA_BUFFER = 2000;
const STOP_AGE = 90; // no further conversions after the primary turns this age

export function optimizeRothLadder(scenario: Scenario, baseStrategy: Strategy): Strategy {
  const primary = scenario.household.primary;
  const startYear = scenario.startYear;

  // Candidate years: from start year through whichever comes first: STOP_AGE, planEndAge, or
  // the year the primary's traditional IRA is depleted. The Roth ladder is most valuable
  // pre-RMD but still valuable post-RMD (heir tax bomb avoidance) — include both.
  const horizonAge = Math.min(STOP_AGE, scenario.household.planEndAge);
  const horizonYear = startYear + (horizonAge - (startYear - primary.birthYear));
  const candidateYears: number[] = [];
  for (let y = startYear; y <= horizonYear; y++) candidateYears.push(y);

  // If primary has no traditional IRA balance, nothing to convert.
  const hasTraditional = scenario.accounts.some(
    (a) => a.ownerId === primary.id && isTraditional(a.type),
  );
  if (!hasTraditional) {
    return { ...baseStrategy, rothConversions: { ...baseStrategy.rothConversions } };
  }

  let strat: Strategy = {
    ...baseStrategy,
    rothConversions: { ...baseStrategy.rothConversions },
  };

  // === Phase 1: greedy per-year ceiling targeting ===
  // Order years by "earlier first" — earlier conversions have more years to grow tax-free.
  // Years past RMD age are included but the greedy step often leaves them at 0 when no ceiling
  // target improves the score (the conversion stacks on top of the RMD).
  for (const year of candidateYears) {
    strat = pickBestConversionForYear(scenario, strat, year);
  }

  // === Phase 2: smoothing ===
  strat = smoothBangs(scenario, strat, candidateYears);

  return strat;
}

function pickBestConversionForYear(
  scenario: Scenario,
  strat: Strategy,
  year: number,
): Strategy {
  const status = scenario.household.filingStatus;
  const primary = scenario.household.primary;
  const primaryAge = year - primary.birthYear;
  const spouseAge = scenario.household.spouse ? year - scenario.household.spouse.birthYear : undefined;

  // Baseline: this year's conversion = 0, others held. Get the row's AGI.
  const zeroStrat: Strategy = {
    ...strat,
    rothConversions: { ...strat.rothConversions, [String(year)]: 0 },
  };
  const baselineResults = runScenario({ ...scenario, strategy: zeroStrat });
  const yearRow = baselineResults.find((r) => r.year === year);
  if (!yearRow) return strat;

  const baselineAgi = yearRow.agi;
  const baselineScore = scoreOf(baselineResults, scenario);

  // Conversion availability: cap at primary's traditional balance at start of year.
  // We approximate using the snapshotted balance from the run — the projection holds prior-year
  // EOY balance which is what RMD/conversion uses, so use the current row's pre-growth state.
  const availableTraditional = getPrimaryTraditionalBalance(scenario, baselineResults, year);

  // Build candidate AGI ceilings — use the federal table that applies to this year (TCJA sunset
  // years have very different bracket widths, and the optimal conversion target shifts accordingly).
  const yearTables = federalTableForYear(year, scenario.assumptions.taxLawMode);
  const baseSd = standardDeduction(status, primaryAge, spouseAge, yearTables);
  // OBBBA senior bonus: use baselineAgi as an approximation of MAGI for phaseout. This is a slight
  // chicken-and-egg (the conversion will raise AGI and may phase out the bonus) but it's a usable
  // first-order target — the actual projection solve handles the precise AGI-dependent bonus.
  const seniorBonus = obbbaSeniorBonus({
    year,
    mode: scenario.assumptions.taxLawMode,
    status,
    primaryAge,
    spouseAge,
    agi: baselineAgi,
  });
  const sd = baseSd + seniorBonus;
  const bracketTops = yearTables.ordinaryBrackets[status]
    .map((b) => b.max)
    .filter((v): v is number => v != null)
    .map((taxableTop) => taxableTop + sd); // convert back to AGI terms

  const irmaaTops = IRMAA.tiers[status]
    .map((t) => t.magiMax)
    .filter((v): v is number => v != null)
    .map((cliff) => cliff - IRMAA_BUFFER); // stop 2K below each cliff

  // Combine, dedupe, sort. Cap at the top-of-32% federal bracket — beyond that the rate is 35%+
  // which is almost never better than letting heirs handle it under the 10-year rule.
  const ceilings = Array.from(new Set([...bracketTops, ...irmaaTops]))
    .filter((c) => c > baselineAgi && c < bracketTops[4]) // bracketTops[4] = top-of-32%
    .sort((a, b) => a - b);

  let bestStrat = strat;
  let bestScore = baselineScore;

  // Probe: for each ceiling, conversion = ceiling - baselineAgi, capped at availableTraditional.
  // Also probe 0 explicitly (in case current value is non-zero from a prior pass).
  const candidateAmounts = [0];
  for (const ceiling of ceilings) {
    const target = Math.min(ceiling - baselineAgi, availableTraditional);
    if (target <= 0) continue;
    candidateAmounts.push(Math.round(target));
  }

  for (const amount of candidateAmounts) {
    const trial: Strategy = {
      ...strat,
      rothConversions: { ...strat.rothConversions, [String(year)]: amount },
    };
    const results = runScenario({ ...scenario, strategy: trial });
    const score = scoreOf(results, scenario);
    if (score > bestScore) {
      bestScore = score;
      bestStrat = trial;
    }
  }

  return bestStrat;
}

/**
 * Smoothing: identify years whose conversion is much larger than the rolling neighborhood
 * average, and try redistributing some of that conversion to neighboring years. Keep the
 * smoothed schedule only if it scores at least as well as the un-smoothed schedule.
 */
function smoothBangs(
  scenario: Scenario,
  strat: Strategy,
  candidateYears: number[],
): Strategy {
  const conversions = candidateYears.map((y) => ({ year: y, amount: strat.rothConversions[String(y)] ?? 0 }));
  const nonZero = conversions.filter((c) => c.amount > 0);
  if (nonZero.length === 0) return strat;
  const total = nonZero.reduce((s, c) => s + c.amount, 0);
  const mean = total / nonZero.length;

  let current = strat;
  let currentScore = scoreOf(runScenario({ ...scenario, strategy: current }), scenario);

  // Find the biggest "bang" — a year whose conversion is >2x mean.
  const sorted = [...nonZero].sort((a, b) => b.amount - a.amount);
  for (const big of sorted) {
    if (big.amount <= 2 * mean) break;
    // Try spreading half of `big`'s amount across the next 1-3 years
    for (const spread of [1, 2, 3]) {
      const candidate: Strategy = {
        ...current,
        rothConversions: { ...current.rothConversions },
      };
      const moveAmount = big.amount * 0.4;
      const perYear = moveAmount / spread;
      candidate.rothConversions[String(big.year)] = big.amount - moveAmount;
      for (let i = 1; i <= spread; i++) {
        const yr = String(big.year + i);
        candidate.rothConversions[yr] = (candidate.rothConversions[yr] ?? 0) + perYear;
      }
      const score = scoreOf(runScenario({ ...scenario, strategy: candidate }), scenario);
      if (score > currentScore) {
        current = candidate;
        currentScore = score;
      }
    }
  }

  return current;
}

function getPrimaryTraditionalBalance(
  scenario: Scenario,
  results: YearResult[],
  year: number,
): number {
  // Walk back to the prior year's balancesEoy for primary's traditional accounts.
  const primaryId = scenario.household.primary.id;
  const traditionalIds = new Set(
    scenario.accounts.filter((a) => a.ownerId === primaryId && isTraditional(a.type)).map((a) => a.id),
  );
  if (year === scenario.startYear) {
    return scenario.accounts
      .filter((a) => traditionalIds.has(a.id))
      .reduce((s, a) => s + a.balance, 0);
  }
  const prior = results.find((r) => r.year === year - 1);
  if (!prior) return 0;
  return prior.balancesEoy
    .filter((b) => traditionalIds.has(b.accountId))
    .reduce((s, b) => s + b.balance, 0);
}

function scoreOf(results: YearResult[], scenario: Scenario): number {
  return scoreResults({
    results,
    discountRate: scenario.assumptions.discountRate,
    startYear: scenario.startYear,
  }).score;
}
