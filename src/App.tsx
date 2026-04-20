import { useEffect, useState } from 'react';
import { InputWizard } from './ui/InputWizard/InputWizard';
import { ResultsDashboard } from './ui/ResultsDashboard/ResultsDashboard';
import { StrategyCompare } from './ui/StrategyCompare/StrategyCompare';
import { ExportPromptModal } from './ui/ExportPromptModal/ExportPromptModal';
import { Help } from './ui/Help/Help';
import { Landing } from './ui/Landing/Landing';
import { useScenarioStore } from './state/scenarioStore';
import { downloadScenarioJson, pickAndLoadScenarioJson } from './persistence/save';
import { makeBlankScenario } from './state/defaults';

type Tab = 'inputs' | 'results' | 'strategies' | 'help';
type View = 'landing' | 'app';

const BMC_URL = 'https://www.buymeacoffee.com/retireright';

function viewFromHash(): View {
  return typeof window !== 'undefined' && window.location.hash === '#app' ? 'app' : 'landing';
}

export function App() {
  const [view, setView] = useState<View>(viewFromHash);
  const [tab, setTab] = useState<Tab>('inputs');
  const [exportOpen, setExportOpen] = useState(false);
  const scenario = useScenarioStore((s) => s.scenario);
  const loadScenario = useScenarioStore((s) => s.setScenario);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const launchApp = () => {
    window.location.hash = 'app';
    setView('app');
  };

  const backToLanding = () => {
    window.location.hash = '';
    setView('landing');
  };

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

  if (view === 'landing') {
    return <Landing onLaunch={launchApp} />;
  }

  return (
    <div className="app">
      <div className="app-header">
        <div>
          <h1 style={{ cursor: 'pointer' }} onClick={backToLanding} title="Back to landing page">
            Retire Right
          </h1>
          <div className="subtitle">100% local · no server · your data never leaves this browser</div>
        </div>
        <div className="toolbar">
          <button onClick={handleLoad}>Load JSON…</button>
          <button onClick={() => downloadScenarioJson(scenario)}>Save JSON</button>
          <button onClick={() => setExportOpen(true)}>Export AI prompt…</button>
          <button className="btn-danger" onClick={handleClear} title="Reset every field to blank">
            Clear all data
          </button>
          <a
            className="app-support-link"
            href={BMC_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Support Retire Right"
          >
            ☕ Support
          </a>
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
        <button
          className={`tab ${tab === 'help' ? 'active' : ''}`}
          onClick={() => setTab('help')}
          style={{ marginLeft: 'auto' }}
        >
          Help
        </button>
      </div>

      {tab === 'inputs' && <InputWizard />}
      {tab === 'results' && <ResultsDashboard />}
      {tab === 'strategies' && <StrategyCompare onApply={() => setTab('results')} />}
      {tab === 'help' && <Help />}

      {exportOpen && <ExportPromptModal onClose={() => setExportOpen(false)} />}
    </div>
  );
}
