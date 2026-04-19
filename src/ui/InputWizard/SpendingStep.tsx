import { useScenarioStore } from '../../state/scenarioStore';

export function SpendingStep() {
  const scenario = useScenarioStore((s) => s.scenario);
  const update = useScenarioStore((s) => s.updateScenario);
  const sp = scenario.spending;

  return (
    <div className="panel">
      <h2>Spending plan</h2>
      <div className="grid-2">
        <div className="field">
          <label>Base annual spending (today's dollars)</label>
          <input
            type="number"
            value={sp.baseAnnual}
            onChange={(e) =>
              update((s) => ({ ...s, spending: { ...s.spending, baseAnnual: Number(e.target.value) } }))
            }
          />
        </div>
        <div className="field">
          <label>Pre-65 healthcare add-on</label>
          <input
            type="number"
            value={sp.healthcarePre65Annual}
            onChange={(e) =>
              update((s) => ({ ...s, spending: { ...s.spending, healthcarePre65Annual: Number(e.target.value) } }))
            }
          />
        </div>
        <div className="field">
          <label>Spending inflation</label>
          <input
            type="number"
            step="0.001"
            value={sp.inflation}
            onChange={(e) =>
              update((s) => ({ ...s, spending: { ...s.spending, inflation: Number(e.target.value) } }))
            }
          />
        </div>
      </div>
    </div>
  );
}
