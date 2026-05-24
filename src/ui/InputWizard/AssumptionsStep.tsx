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
        <div className="field">
          <label title="Effective tax rate heirs would pay on inherited traditional IRA/401(k) withdrawals under the SECURE Act 10-year rule. Used to compute after-heir-tax ending wealth.">
            Heir marginal tax rate
          </label>
          <input
            type="number"
            step="0.01"
            min={0}
            max={0.6}
            value={a.heirMarginalTaxRate}
            onChange={(e) =>
              update((s) => ({
                ...s,
                assumptions: { ...s.assumptions, heirMarginalTaxRate: Number(e.target.value) },
              }))
            }
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Default 32% assumes a mid-career professional non-spouse heir. The strategy cards also
            show a sensitivity table at 22/24/32/35% so you can see how robust each plan is to this
            assumption. Set to 0 to score ending wealth at face value.
          </div>
        </div>
        <div className="field">
          <label title="If selected, federal tax brackets revert to pre-TCJA (10/15/25/28/33/35/39.6%) in 2026 and beyond. Use this to see how robust your conversion plan is to the rate-path uncertainty.">
            Tax law mode
          </label>
          <select
            value={a.taxLawMode}
            onChange={(e) =>
              update((s) => ({
                ...s,
                assumptions: {
                  ...s.assumptions,
                  taxLawMode: e.target.value as 'current-law' | 'tcja-sunset',
                },
              }))
            }
          >
            <option value="current-law">Current law (TCJA extended)</option>
            <option value="tcja-sunset">TCJA sunset (pre-2018 brackets from 2026)</option>
          </select>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            The right Roth conversion plan is rate-path dependent. Run the optimizer under both
            modes if you're uncertain — the sunset scenario raises the value of converting now.
          </div>
        </div>
      </div>
      <div className="warning">
        All tax tables use 2025 rates and (when sunset mode is selected) approximate 2026 pre-TCJA
        levels. Future-year projections assume tables stay static — revisit when tax law changes.
      </div>
    </div>
  );
}
