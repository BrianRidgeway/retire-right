import { useScenarioStore } from '../../state/scenarioStore';
import { HelpButton } from '../HelpButton/HelpButton';

export function SpendingStep() {
  const scenario = useScenarioStore((s) => s.scenario);
  const update = useScenarioStore((s) => s.updateScenario);
  const sp = scenario.spending;

  return (
    <div className="panel">
      <h2>Spending plan</h2>
      <div className="grid-2">
        <div className="field">
          <label>
            Base annual spending (today's dollars)
            <HelpButton title="Base annual spending">
              <p>
                Your recurring annual cash outflow in today's dollars, <strong>before income tax and before Medicare
                premiums</strong>. The engine inflates this each year by the spending inflation rate.
              </p>
              <p><strong>Include:</strong></p>
              <ul>
                <li>Housing — mortgage/rent, property tax, insurance, utilities, maintenance</li>
                <li>Food, transportation, vehicle costs</li>
                <li>Out-of-pocket healthcare past 65: Medigap or Medicare Advantage premiums, dental, vision, hearing, copays, drugs not covered by Part D</li>
                <li>Travel, hobbies, entertainment, subscriptions</li>
                <li>Non-charitable gifts (to kids, grandkids — those don't QCD)</li>
                <li>Property/casualty/umbrella/life insurance</li>
              </ul>
              <p><strong>Don't include</strong> (the engine handles these elsewhere):</p>
              <ul>
                <li>Federal / state / county income tax — solved each year</li>
                <li>NIIT — computed from MAGI</li>
                <li>Medicare Part B base + Part D surcharge — in the IRMAA line</li>
                <li>Pre-65 healthcare premiums — separate field below</li>
                <li>Annual charitable giving — separate QCD-routed field below</li>
                <li>One-off items (new roof, kid's wedding, LTC) — use one-offs instead so they don't recur every year</li>
              </ul>
            </HelpButton>
          </label>
          <input
            type="number"
            value={sp.baseAnnual}
            onChange={(e) =>
              update((s) => ({ ...s, spending: { ...s.spending, baseAnnual: Number(e.target.value) } }))
            }
          />
        </div>
        <div className="field">
          <label>
            Pre-65 healthcare add-on
            <HelpButton title="Pre-65 healthcare">
              <p>
                Annual healthcare premiums + out-of-pocket spend while the primary is under 65 (before Medicare
                eligibility). Common sources: ACA/marketplace plan, COBRA, retiree-medical plan, or spousal coverage
                with a contribution.
              </p>
              <p>
                The engine adds this on top of <em>base annual spending</em> for every year primary age &lt; 65, then
                drops it once Medicare kicks in. Set to 0 if both spouses are already 65+ at plan start, or if you
                already included healthcare in base annual spending.
              </p>
              <p>
                Typical ranges: $8K–$25K per person for an ACA bronze/silver plan after subsidies; $20K–$30K for
                COBRA without an employer subsidy. Get a quote at healthcare.gov for your actual numbers.
              </p>
            </HelpButton>
          </label>
          <input
            type="number"
            value={sp.healthcarePre65Annual}
            onChange={(e) =>
              update((s) => ({ ...s, spending: { ...s.spending, healthcarePre65Annual: Number(e.target.value) } }))
            }
          />
        </div>
        <div className="field">
          <label>
            Spending inflation
            <HelpButton title="Spending inflation">
              <p>
                Annual growth rate of your spending. Distinct from general inflation (on the Assumptions tab) because
                you may have personal-inflation reasons to use a different rate — e.g. expecting more travel in early
                retirement followed by lower spending late, or higher medical inflation pulling the overall number up.
              </p>
              <p>
                Default <strong>0.025</strong> (2.5%) matches Fed long-run target. Many retirees use 3% to be
                conservative or to reflect that medical/insurance costs rise faster than the broad CPI.
              </p>
            </HelpButton>
          </label>
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
          <label>
            Annual charitable giving (QCD-routed)
            <HelpButton title="Annual charitable giving (QCD)">
              <p>
                Annual amount you give to qualifying 501(c)(3) charities (in today's dollars). For any spouse age 70.5+
                with a traditional IRA balance, this is automatically routed as a <strong>Qualified Charitable
                Distribution</strong> (QCD):
              </p>
              <ul>
                <li>Comes out of the traditional IRA pre-tax</li>
                <li>Counts toward that year's RMD (dollar for dollar)</li>
                <li>Is <em>excluded</em> from AGI/MAGI — no impact on IRMAA tier, SS taxation, NIIT, or the OBBBA senior-bonus phaseout</li>
              </ul>
              <p>
                Capped at $108,000 per person (2025; indexed annually). If both spouses are 70.5+, the cap doubles
                and the giving is split across their traditional IRAs pro-rata by balance.
              </p>
              <p>Set to 0 if you don't have charitable intent — QCD modeling is skipped silently.</p>
            </HelpButton>
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
