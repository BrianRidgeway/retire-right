import { Person, Scenario, Strategy } from '../../types';
import { runScenario } from '../projection';
import { scoreResults } from './score';

/**
 * Grid-search Social Security claim ages (62-70) per spouse.
 * If a person has already claimed, their claim age is fixed — past decisions
 * are not optimizable, so we only try their actual claim age.
 */
export function optimizeSsClaim(scenario: Scenario, baseStrategy: Strategy): Strategy {
  const primary = scenario.household.primary;
  const spouse = scenario.household.spouse;
  const currentYear = scenario.startYear;

  let bestStrat: Strategy = {
    ...baseStrategy,
    ssClaimAges: { ...baseStrategy.ssClaimAges },
  };
  let bestScore = -Infinity;

  const primaryChoices = claimChoicesFor(primary, currentYear);
  const spouseChoices = spouse ? claimChoicesFor(spouse, currentYear) : [undefined];

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

function claimChoicesFor(person: Person, currentYear: number): number[] {
  const currentAge = currentYear - person.birthYear;
  // If the claim is already in the past, it's locked — past decisions aren't optimizable.
  if (person.ssAlreadyClaimed || currentAge >= person.ssClaimAge) {
    return [person.ssClaimAge];
  }
  // Otherwise grid-search standard ages, but never below current age (can't claim retroactively).
  const options = [62, 65, 67, 70, person.ssClaimAge].filter((a) => a >= currentAge);
  return Array.from(new Set(options)).sort((a, b) => a - b);
}
