import { useScenarioStore } from '../../state/scenarioStore';
import { HelpButton } from '../HelpButton/HelpButton';

export function AssumptionsStep() {
  const scenario = useScenarioStore((s) => s.scenario);
  const update = useScenarioStore((s) => s.updateScenario);
  const a = scenario.assumptions;

  return (
    <div className="panel">
      <h2>Assumptions</h2>
      <div className="grid-2">
        <div className="field">
          <label>
            General inflation
            <HelpButton title="General inflation">
              <p>
                Annual rate at which tax brackets, IRMAA tiers, standard deduction, etc. are expected to be indexed.
                Used wherever the engine needs to project nominal dollar amounts forward.
              </p>
              <p>
                Typical value: <strong>0.025</strong> (2.5%) — roughly the Fed's long-run target. Use 0.02 for a more
                conservative inflation assumption or 0.03 if you expect a sustained higher-inflation regime.
              </p>
            </HelpButton>
          </label>
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
          <label>
            Discount rate (for PV scoring)
            <HelpButton title="Discount rate">
              <p>
                The annual rate used to convert future dollars into present-value (PV) for the optimizer's score.
                Higher discount rate = future dollars are worth less today = the optimizer prefers strategies that
                deliver value sooner. Lower discount rate = the optimizer values long-term heir wealth more heavily.
              </p>
              <p>
                Typical value: <strong>0.03</strong> (3%) — roughly the long-term real return on a balanced portfolio.
                Use your own personal discount rate if you have one (some people use the 10-year Treasury, others use
                their portfolio's expected return).
              </p>
            </HelpButton>
          </label>
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
          <label>
            Heir marginal tax rate
            <HelpButton title="Heir marginal tax rate">
              <p>
                The combined federal + state marginal rate your heirs will pay on inherited traditional IRA/401(k)
                distributions. Under the SECURE Act 10-year rule, non-spouse beneficiaries must drain the inherited
                account within 10 years; each distribution hits their tax return as ordinary income.
              </p>
              <p>
                Defaults to <strong>0.32</strong> (32%) — typical for a mid-career professional non-spouse heir at
                today's federal+state rates. Lower it if your heirs are in lower brackets; raise it if they're high
                earners. Set to 0 to score ending wealth at face value (ignore heir tax).
              </p>
              <p>
                Every strategy also shows a sensitivity table at 22/24/32/35% so you can see how robust the plan is
                to this assumption.
              </p>
            </HelpButton>
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
          <label>
            Tax law mode
            <HelpButton title="Tax law mode">
              <p>
                Which federal tax regime to assume for future years. The right Roth conversion plan is
                <em> rate-path dependent</em> — converting now is more valuable when future rates will be higher.
              </p>
              <p>
                <strong>OBBBA</strong> (default): the actual current law as of July 2025. TCJA individual rate cuts
                made permanent (10/12/22/24/32/35/37% brackets continue), <em>plus</em> a $6,000 senior bonus
                deduction per spouse age 65+ for tax years 2025-2028 (phases out 6% per dollar of MAGI over
                $150K MFJ / $75K single; fully gone at $250K MFJ / $175K single). The senior bonus sunsets
                after 2028 unless extended.
              </p>
              <p>
                <strong>Current law (TCJA extended)</strong>: TCJA rates continue indefinitely with no senior
                bonus. Same brackets as OBBBA but without the bonus deduction. Useful as a comparison baseline.
              </p>
              <p>
                <strong>TCJA sunset</strong>: pre-2018 brackets (10/15/25/28/33/35/39.6%) kick in starting 2026,
                with a smaller standard deduction. Use this to stress-test your plan against a hypothetical
                rate-hike scenario — it makes pre-2029 conversions look much more valuable.
              </p>
            </HelpButton>
          </label>
          <select
            value={a.taxLawMode}
            onChange={(e) =>
              update((s) => ({
                ...s,
                assumptions: {
                  ...s.assumptions,
                  taxLawMode: e.target.value as 'current-law' | 'tcja-sunset' | 'obbba',
                },
              }))
            }
          >
            <option value="obbba">OBBBA (current law, includes 65+ senior bonus 2025–2028)</option>
            <option value="current-law">Current law (TCJA extended, no senior bonus)</option>
            <option value="tcja-sunset">TCJA sunset (pre-2018 brackets from 2026)</option>
          </select>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Run the optimizer under multiple modes if you're uncertain — sunset raises the value of converting now.
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
