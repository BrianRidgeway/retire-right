import { create } from 'zustand';
import { Scenario, StrategyResult, YearResult } from '../types';
import { makeDefaultScenario } from './defaults';
import { runScenario } from '../engine/projection';
import { runOptimizer } from '../engine/optimizer/combine';
import { scoreResults } from '../engine/optimizer/score';

type ScenarioStore = {
  scenario: Scenario;
  currentResults: YearResult[];
  optimizerResults: StrategyResult[] | null;
  optimizerRunning: boolean;
  setScenario: (s: Scenario) => void;
  updateScenario: (fn: (s: Scenario) => Scenario) => void;
  recomputeCurrent: () => void;
  runOptimizer: () => Promise<void>;
};

function safeRun(s: Scenario): YearResult[] {
  try {
    return runScenario(s);
  } catch (e) {
    console.error('runScenario failed', e);
    return [];
  }
}

const initialScenario = makeDefaultScenario();

export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  scenario: initialScenario,
  currentResults: safeRun(initialScenario),
  optimizerResults: null,
  optimizerRunning: false,
  setScenario: (s) => {
    set({
      scenario: s,
      currentResults: safeRun(s),
      optimizerResults: null,
    });
  },
  updateScenario: (fn) => {
    const next = fn(get().scenario);
    set({
      scenario: next,
      currentResults: safeRun(next),
      optimizerResults: null,
    });
  },
  recomputeCurrent: () => {
    set({ currentResults: safeRun(get().scenario) });
  },
  runOptimizer: async () => {
    set({ optimizerRunning: true });
    // Yield to the UI before blocking work.
    await new Promise((r) => setTimeout(r, 0));
    try {
      const results = runOptimizer(get().scenario);
      set({ optimizerResults: results, optimizerRunning: false });
    } catch (e) {
      console.error('Optimizer failed', e);
      set({ optimizerRunning: false });
    }
  },
}));

export function lifetimeTotals(results: YearResult[], discountRate: number, startYear: number) {
  return scoreResults({ results, discountRate, startYear });
}
