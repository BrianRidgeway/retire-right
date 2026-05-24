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
        <div className="field">
          <label title="Annual charitable giving. Automatically routed as a Qualified Charitable Distribution (QCD) for any spouse age 70.5+ with a traditional IRA — comes out pre-tax, counts toward RMD, and is excluded from AGI (no IRMAA / SS-taxation / NIIT impact).">
            Annual charitable giving (QCD-routed)
          </label>
          <input
            type="number"
            value={sp.annualCharitableGiving}
            onChange={(e) =>
              update((s) => ({
                ...s,
                spending: { ...s.spending, annualCharitableGiving: Number(e.target.value) },
              }))
            }
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Capped at $108K per person (2025). Leave at 0 if no charitable intent — QCD modeling is skipped.
          </div>
        </div>
      </div>
    </div>
  );
}
