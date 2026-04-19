import { Scenario, Strategy } from '../../types';
import { runScenario } from '../projection';
import { scoreResults } from './score';

/**
 * Grid-search Social Security claim ages (62-70) per spouse.
 */
export function optimizeSsClaim(scenario: Scenario, baseStrategy: Strategy): Strategy {
  const primary = scenario.household.primary;
  const spouse = scenario.household.spouse;

  let bestStrat: Strategy = {
    ...baseStrategy,
    ssClaimAges: { ...baseStrategy.ssClaimAges },
  };
  let bestScore = -Infinity;

  const primaryChoices = claimAgeOptions(primary.ssClaimAge);
  const spouseChoices = spouse ? claimAgeOptions(spouse.ssClaimAge) : [undefined];

  for (const pAge of primaryChoices) {
    for (const sAge of spouseChoices) {
      const modHousehold = {
        ...scenario.household,
        primary: { ...primary, ssClaimAge: pAge },
        spouse: spouse && sAge != null ? { ...spouse, ssClaimAge: sAge } : spouse,
      };
      const strat: Strategy = {
        ...bestStrat,
        ssClaimAges: sAge != null ? { [primary.id]: pAge, [spouse!.id]: sAge } : { [primary.id]: pAge },
      };
      const trialScenario = { ...scenario, household: modHousehold, strategy: strat };
      const s = scoreResults({
        results: runScenario(trialScenario),
        discountRate: scenario.assumptions.discountRate,
        startYear: scenario.startYear,
      }).score;
      if (s > bestScore) {
        bestScore = s;
        bestStrat = strat;
      }
    }
  }
  return bestStrat;
}

function claimAgeOptions(current: number): number[] {
  // Evaluate 62, 65, 67, 70 plus current setting.
  return Array.from(new Set([62, 65, 67, 70, current])).sort((a, b) => a - b);
}
