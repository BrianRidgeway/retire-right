import { Scenario, YearResult } from '../../types';

export type ScoreInputs = {
  results: YearResult[];
  discountRate: number;
  startYear: number;
};

export type ScoreBreakdown = {
  score: number;
  lifetimeAfterTax: number;
  lifetimeTax: number;
  endingNetWorth: number;
  anyShortfall: boolean;
  pvSpending: number;
  pvEndingWealth: number;
};

/**
 * Score = PV of covered spending + PV of ending net worth.
 * Spending covered counts; shortfalls are penalized (subtract from score).
 */
export function scoreResults(inputs: ScoreInputs): ScoreBreakdown {
  const { results, discountRate, startYear } = inputs;
  let pvSpending = 0;
  let lifetimeAfterTax = 0;
  let lifetimeTax = 0;
  let anyShortfall = false;
  let shortfallPenaltyPv = 0;

  for (const y of results) {
    const t = y.year - startYear;
    const df = Math.pow(1 + discountRate, -t);
    const covered = y.spendingNeed - y.cashShortfall;
    pvSpending += covered * df;
    lifetimeAfterTax += covered;
    lifetimeTax += y.totalTax;
    if (y.cashShortfall > 0) {
      anyShortfall = true;
      shortfallPenaltyPv += y.cashShortfall * df * 2; // 2x penalty for going dry
    }
  }

  const last = results[results.length - 1];
  const endingNetWorth = last ? last.netWorthEoy : 0;
  const df = last ? Math.pow(1 + discountRate, -(last.year - startYear)) : 1;
  const pvEndingWealth = endingNetWorth * df;

  const score = pvSpending + pvEndingWealth - shortfallPenaltyPv;
  return { score, lifetimeAfterTax, lifetimeTax, endingNetWorth, anyShortfall, pvSpending, pvEndingWealth };
}

export function baselineScenario(scenario: Scenario): Scenario {
  return {
    ...scenario,
    strategy: {
      rothConversions: {},
      withdrawalPolicy: 'conventional',
      ssClaimAges: {},
      label: 'Do nothing',
    },
  };
}
