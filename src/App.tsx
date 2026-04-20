import { useState } from 'react';
import { InputWizard } from './ui/InputWizard/InputWizard';
import { ResultsDashboard } from './ui/ResultsDashboard/ResultsDashboard';
import { StrategyCompare } from './ui/StrategyCompare/StrategyCompare';
import { ExportPromptModal } from './ui/ExportPromptModal/ExportPromptModal';
import { useScenarioStore } from './state/scenarioStore';
import { downloadScenarioJson, pickAndLoadScenarioJson } from './persistence/save';
import { makeBlankScenario } from './state/defaults';

type Tab = 'inputs' | 'results' | 'strategies';

export function App() {
  const [tab, setTab] = useState<Tab>('inputs');
  const [exportOpen, setExportOpen] = useState(false);
  const scenario = useScenarioStore((s) => s.scenario);
  const loadScenario = useScenarioStore((s) => s.setScenario);

  const handleLoad = async () => {
    try {
      const loaded = await pickAndLoadScenarioJson();
      if (loaded) loadScenario(loaded);
    } catch (err) {
      alert(`Load failed: ${(err as Error).message}`);
    }
  };

  const handleClear = () => {
    const confirmed = window.confirm(
      'Clear all data? This resets every account, income stream, spending amount, and strategy to blank. Consider saving your current plan first (Save JSON). This cannot be undone.',
    );
    if (confirmed) {
      loadScenario(makeBlankScenario());
      setTab('inputs');
    }
  };

  return (
    <div className="app">
      <div className="app-header">
        <div>
          <h1>Retirement Planner</h1>
          <div className="subtitle">100% local · no server · your data never leaves this browser</div>
        </div>
        <div className="toolbar">
          <button onClick={handleLoad}>Load JSON…</button>
          <button onClick={() => downloadScenarioJson(scenario)}>Save JSON</button>
          <button onClick={() => setExportOpen(true)}>Export AI prompt…</button>
          <button className="btn-danger" onClick={handleClear} title="Reset every field to blank">
            Clear all data
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'inputs' ? 'active' : ''}`} onClick={() => setTab('inputs')}>
          Inputs
        </button>
        <button className={`tab ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')}>
          Results
        </button>
        <button className={`tab ${tab === 'strategies' ? 'active' : ''}`} onClick={() => setTab('strategies')}>
          Strategies
        </button>
      </div>

      {tab === 'inputs' && <InputWizard />}
      {tab === 'results' && <ResultsDashboard />}
      {tab === 'strategies' && <StrategyCompare onApply={() => setTab('results')} />}

      {exportOpen && <ExportPromptModal onClose={() => setExportOpen(false)} />}
    </div>
  );
}
