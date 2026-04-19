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
  endingHeirNetWorth: number;
  anyShortfall: boolean;
  pvSpending: number;
  pvEndingWealth: number;
};

/**
 * Score = PV of covered spending + PV of heir-net ending wealth.
 * Using heir-net (not face-value net worth) means the optimizer correctly prefers
 * strategies that leave Roth/taxable dollars to heirs over traditional IRA dollars
 * they would pay ordinary income tax on. Shortfalls are penalized.
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
      shortfallPenaltyPv += y.cashShortfall * df * 2;
    }
  }

  const last = results[results.length - 1];
  const endingNetWorth = last ? last.netWorthEoy : 0;
  const endingHeirNetWorth = last ? last.heirNetWorthEoy : 0;
  const df = last ? Math.pow(1 + discountRate, -(last.year - startYear)) : 1;
  const pvEndingWealth = endingHeirNetWorth * df;

  const score = pvSpending + pvEndingWealth - shortfallPenaltyPv;
  return {
    score,
    lifetimeAfterTax,
    lifetimeTax,
    endingNetWorth,
    endingHeirNetWorth,
    anyShortfall,
    pvSpending,
    pvEndingWealth,
  };
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
