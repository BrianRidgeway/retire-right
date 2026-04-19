import { Scenario, Strategy, WithdrawalPolicy } from '../../types';
import { runScenario } from '../projection';
import { scoreResults } from './score';

const POLICIES: WithdrawalPolicy[] = ['conventional', 'proportional', 'bracket-fill'];

export function optimizeWithdrawOrder(scenario: Scenario, baseStrategy: Strategy): Strategy {
  let best = baseStrategy;
  let bestScore = -Infinity;
  for (const policy of POLICIES) {
    const strat: Strategy = { ...baseStrategy, withdrawalPolicy: policy };
    const s = scoreResults({
      results: runScenario({ ...scenario, strategy: strat }),
      discountRate: scenario.assumptions.discountRate,
      startYear: scenario.startYear,
    }).score;
    if (s > bestScore) {
      bestScore = s;
      best = strat;
    }
  }
  return best;
}
