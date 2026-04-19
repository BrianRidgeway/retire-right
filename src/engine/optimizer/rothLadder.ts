import { Scenario, Strategy } from '../../types';
import { FEDERAL, StatusKey } from '../tables';
import { irmaaTierCeilings } from '../tax/irmaa';
import { rmdApplicableAge } from '../rmd';
import { runScenario } from '../projection';
import { scoreResults } from './score';

/**
 * For each pre-RMD year, try candidate conversion amounts anchored at bracket / IRMAA tier tops.
 * Greedy: fix conversions in prior years, pick the best amount this year, move on.
 */
export function optimizeRothLadder(scenario: Scenario, baseStrategy: Strategy): Strategy {
  const status: StatusKey = scenario.household.filingStatus;
  const primary = scenario.household.primary;
  const rmdAge = rmdApplicableAge(primary.birthYear);
  const endConversionAge = rmdAge - 1;

  const startYear = scenario.startYear;
  const lastYear = scenario.startYear + (endConversionAge - (scenario.startYear - primary.birthYear));

  const strat: Strategy = {
    ...baseStrategy,
    rothConversions: { ...baseStrategy.rothConversions },
  };

  const bracketTops = FEDERAL.ordinaryBrackets[status]
    .map((b) => b.max)
    .filter((v): v is number => v != null);
  const irmaaTops = irmaaTierCeilings(status);

  // Candidate AGI targets (conversion pushes AGI up to these).
  const agiTargets = Array.from(
    new Set([
      ...bracketTops.slice(0, 5), // up to ~24%/32% bracket top
      ...irmaaTops.slice(0, 3), // first three IRMAA tiers
    ]),
  ).sort((a, b) => a - b);

  for (let year = Math.max(startYear, startYear); year <= lastYear; year++) {
    let bestAmount = strat.rothConversions[String(year)] ?? 0;
    let bestScore = scoreStrategy(scenario, strat);

    for (const target of agiTargets) {
      // Probe: conversion amount approximately = target - (non-conversion AGI baseline)
      // Simple approach: try target directly as the conversion amount (proxy for filling the bracket).
      for (const amount of [0, target * 0.25, target * 0.5, target * 0.75, target]) {
        strat.rothConversions[String(year)] = amount;
        const s = scoreStrategy(scenario, strat);
        if (s > bestScore) {
          bestScore = s;
          bestAmount = amount;
        }
      }
    }
    strat.rothConversions[String(year)] = bestAmount;
  }
  return strat;
}

function scoreStrategy(scenario: Scenario, strategy: Strategy): number {
  const results = runScenario({ ...scenario, strategy });
  return scoreResults({
    results,
    discountRate: scenario.assumptions.discountRate,
    startYear: scenario.startYear,
  }).score;
}
