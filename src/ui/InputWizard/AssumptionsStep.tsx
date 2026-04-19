import { useScenarioStore } from '../../state/scenarioStore';

export function AssumptionsStep() {
  const scenario = useScenarioStore((s) => s.scenario);
  const update = useScenarioStore((s) => s.updateScenario);
  const a = scenario.assumptions;

  return (
    <div className="panel">
      <h2>Assumptions</h2>
      <div className="grid-2">
        <div className="field">
          <label>General inflation</label>
          <input
            type="number"
            step="0.001"
            value={a.inflation}
            onChange={(e) =>
              update((s) => ({ ...s, assumptions: { ...s.assumptions, inflation: Number(e.target.value) } }))
            }
          />
        </div>
        <div className="field">
          <label>Discount rate (for PV scoring)</label>
          <input
            type="number"
            step="0.001"
            value={a.discountRate}
            onChange={(e) =>
              update((s) => ({ ...s, assumptions: { ...s.assumptions, discountRate: Number(e.target.value) } }))
            }
          />
        </div>
      </div>
      <div className="warning">
        All tax tables use 2025 rates. Future-year projections assume current law continues; revisit when tax law
        changes.
      </div>
    </div>
  );
}
