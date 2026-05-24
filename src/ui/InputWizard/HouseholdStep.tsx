import { useScenarioStore } from '../../state/scenarioStore';
import { mdCountyList, supportedStates } from '../../engine/tax/state';
import { FilingStatus, Person } from '../../types';
import { HelpButton } from '../HelpButton/HelpButton';

export function HouseholdStep() {
  const scenario = useScenarioStore((s) => s.scenario);
  const update = useScenarioStore((s) => s.updateScenario);
  const states = supportedStates();

  const setPerson = (key: 'primary' | 'spouse', fn: (p: Person) => Person) => {
    update((s) => {
      const existing = key === 'primary' ? s.household.primary : s.household.spouse;
      if (!existing) return s;
      return {
        ...s,
        household: {
          ...s.household,
          [key]: fn(existing),
        },
      };
    });
  };

  const toggleSpouse = (has: boolean) => {
    update((s) => {
      if (has) {
        return {
          ...s,
          household: {
            ...s.household,
            filingStatus: 'mfj',
            spouse: s.household.spouse ?? {
              id: 'spouse',
              name: 'Spouse',
              birthYear: s.household.primary.birthYear,
              state: s.household.primary.state,
              ssBenefitAtFra: 30000,
              ssClaimAge: 67,
              ssAlreadyClaimed: false,
              ssCurrentAnnualBenefit: 0,
            },
          },
        };
      }
      return {
        ...s,
        household: { ...s.household, filingStatus: 'single', spouse: undefined },
      };
    });
  };

  const h = scenario.household;

  return (
    <div className="panel">
      <h2>Household</h2>
      <div className="grid-2">
        <div className="field">
          <label>
            Filing status
            <HelpButton title="Filing status">
              <p>
                <strong>Single</strong>: one-person household, single-filer tax brackets and IRMAA tiers (roughly
                half as wide as MFJ).
              </p>
              <p>
                <strong>Married filing jointly (MFJ)</strong>: two-person household, joint brackets. The optimizer
                also runs a survivor scenario where the older spouse dies at 85 — the survivor reverts to single
                brackets from that year on, takes the larger of the two SS benefits, and pension applies its
                survivor election. This is the "widow's penalty" that often justifies aggressive Roth conversions.
              </p>
            </HelpButton>
          </label>
          <select
            value={h.filingStatus}
            onChange={(e) => {
              const v = e.target.value as FilingStatus;
              if (v === 'mfj') toggleSpouse(true);
              else toggleSpouse(false);
            }}
          >
            <option value="single">Single</option>
            <option value="mfj">Married filing jointly</option>
          </select>
        </div>
        <div className="field">
          <label>
            Plan end age (both spouses)
            <HelpButton title="Plan end age">
              <p>
                The age at which the projection ends for the <strong>primary</strong> person. The engine produces
                one row per year from your plan start through the year the primary reaches this age.
              </p>
              <p>
                Common values: 90 (median life expectancy for a healthy 65-year-old), 95 (conservative for most
                couples — there's a meaningful chance at least one spouse reaches this), 100 (very conservative;
                ensures you don't outlive the plan).
              </p>
              <p>
                The survivor scenario continues to this same age after the older spouse dies at 85, so picking a
                high value (95–100) makes the survivor scenario more meaningful for couples.
              </p>
            </HelpButton>
          </label>
          <input
            type="number"
            value={h.planEndAge}
            onChange={(e) =>
              update((s) => ({ ...s, household: { ...s.household, planEndAge: Number(e.target.value) } }))
            }
          />
        </div>
      </div>

      <h3>Primary</h3>
      <PersonFields
        person={h.primary}
        states={states}
        onChange={(p) => setPerson('primary', () => p)}
      />

      {h.spouse && (
        <>
          <h3>Spouse</h3>
          <PersonFields person={h.spouse} states={states} onChange={(p) => setPerson('spouse', () => p)} />
        </>
      )}

      <h3>
        Start year
        <HelpButton title="Start year">
          <p>
            The calendar year the projection begins. It anchors the whole timeline: it's year 1 of the results
            table, the reference point for PV discounting, and the basis for IRMAA's Y-2 MAGI lookback.
          </p>
          <p>
            Almost always set this to <strong>the current year</strong> or the year you intend to retire. Setting
            it to a past year means you're projecting an already-elapsed period — useful for back-testing, not
            for live planning.
          </p>
        </HelpButton>
      </h3>
      <div className="field" style={{ maxWidth: 200 }}>
        <input
          type="number"
          value={scenario.startYear}
          onChange={(e) => update((s) => ({ ...s, startYear: Number(e.target.value) }))}
        />
      </div>
    </div>
  );
}

function PersonFields({
  person,
  states,
  onChange,
}: {
  person: Person;
  states: string[];
  onChange: (p: Person) => void;
}) {
  return (
    <div className="grid-3">
      <div className="field">
        <label>Name</label>
        <input value={person.name} onChange={(e) => onChange({ ...person, name: e.target.value })} />
      </div>
      <div className="field">
        <label>
          Birth year
          <HelpButton title="Birth year">
            <p>
              Used to derive: current age, Full Retirement Age for Social Security, RMD applicable age under
              SECURE 2.0 (73 for 1951–1959, 75 for 1960+), Medicare eligibility year (age 65), QCD eligibility
              age (70½), and the survivor scenario's death year (older spouse's birth + 85).
            </p>
            <p>
              Enter the 4-digit year (e.g. <code>1954</code>). Don't enter the current age — use birth year so
              the projection stays correct across calendar years.
            </p>
          </HelpButton>
        </label>
        <input
          type="number"
          value={person.birthYear}
          onChange={(e) => onChange({ ...person, birthYear: Number(e.target.value) })}
        />
      </div>
      <div className="field">
        <label>
          State
          <HelpButton title="State of residence">
            <p>
              Two-letter state code. Drives state income tax computation: brackets, retirement-income exclusions,
              SS taxability at the state level, and (for MD) the county local tax dropdown.
            </p>
            <p>
              Supported with full brackets: CA, NY, MD, PA, FL, TX, WA. States not in the dropdown can be added
              by editing <code>src/tables/states-2025.json</code>. None of the supported states tax SS; PA, FL,
              TX, WA fully exempt retirement distributions.
            </p>
          </HelpButton>
        </label>
        <select value={person.state} onChange={(e) => onChange({ ...person, state: e.target.value })}>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {person.state === 'MD' && (
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>
            MD county (for local income tax)
            <HelpButton title="MD county">
              <p>
                Maryland counties (and Baltimore City) charge a local income tax of 1.75%–3.2% on top of state
                brackets. The correct county can make a meaningful difference on lifetime tax — Howard,
                Montgomery, Baltimore City, Prince George's are all 3.2% (top of range); Worcester is 1.75%
                (bottom).
              </p>
              <p>
                Pick the county where you'll be a tax-domiciled resident in retirement. Leave as default to use
                the statewide ~3% average (a coarse approximation).
              </p>
            </HelpButton>
          </label>
          <select
            value={person.countyCode ?? ''}
            onChange={(e) => onChange({ ...person, countyCode: e.target.value || undefined })}
          >
            <option value="">— use statewide average (3.0%) —</option>
            {mdCountyList().map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({(c.rate * 100).toFixed(2)}%)
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field" style={{ gridColumn: '1 / -1' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={person.ssAlreadyClaimed}
            onChange={(e) => onChange({ ...person, ssAlreadyClaimed: e.target.checked })}
          />
          Already collecting Social Security
          <HelpButton title="Already collecting SS">
            <p>
              Check this box if this person has <em>already filed for Social Security</em> and is receiving
              monthly checks at plan start. The model will use the actual benefit you report rather than
              computing one from PIA × claim-age multiplier.
            </p>
            <p>
              If left unchecked but the person is already past their planned claim age, the strategy cards will
              raise a "Concerns" flag — either correct the claim age or check this box and enter the actual
              benefit.
            </p>
          </HelpButton>
        </label>
      </div>
      {person.ssAlreadyClaimed ? (
        <>
          <div className="field">
            <label>
              Current SS benefit (annual)
              <HelpButton title="Current SS benefit">
                <p>
                  The actual gross annual benefit (before Medicare premium deduction) this person is currently
                  receiving. Pull this from your most recent SSA statement or my Social Security online account.
                </p>
                <p>
                  Enter the <em>annual</em> figure — if your monthly check is $3,500, enter $42,000. The engine
                  projects this forward at the SS COLA (currently bundled into general inflation; SSA COLAs
                  historically average ~2.5%).
                </p>
              </HelpButton>
            </label>
            <input
              type="number"
              value={person.ssCurrentAnnualBenefit}
              onChange={(e) => onChange({ ...person, ssCurrentAnnualBenefit: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>
              Age when claimed
              <HelpButton title="Age when claimed">
                <p>
                  The age at which this person first filed for Social Security. Informational only when "Already
                  collecting" is checked — the projection uses the actual current benefit you entered, not the
                  PIA × multiplier path. It does show up in concerns and reports.
                </p>
              </HelpButton>
            </label>
            <input
              type="number"
              min={62}
              max={70}
              value={person.ssClaimAge}
              onChange={(e) => onChange({ ...person, ssClaimAge: Number(e.target.value) })}
            />
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label>
              SS benefit at Full Retirement Age (PIA, annual)
              <HelpButton title="SS benefit at FRA (PIA)">
                <p>
                  Your <strong>Primary Insurance Amount</strong> (PIA) — the annual Social Security benefit you'd
                  receive if you claim at exactly your Full Retirement Age. This is the headline number on your
                  SSA statement; sometimes labeled "at FRA" or "at 67" (SSA assumes FRA=67 for everyone born
                  1960+).
                </p>
                <p>
                  The engine multiplies this by the claim-age multiplier per SSA rules:
                </p>
                <ul>
                  <li><strong>Claiming before FRA</strong>: −5/9% per month for first 36 months early, −5/12% beyond</li>
                  <li><strong>Claiming at FRA</strong>: 1.0× (PIA)</li>
                  <li><strong>Delaying past FRA</strong>: +8%/year (born 1943+) up to age 70 (+32% for FRA-66 or +24% for FRA-67)</li>
                </ul>
                <p>
                  FRA depends on birth year: 66 for 1943-1954, 66+2mo to 66+10mo for 1955-1959, 67 for 1960+.
                  Enter the <em>annual</em> amount; e.g. if SSA says $3,239/mo, enter $38,875.
                </p>
              </HelpButton>
            </label>
            <input
              type="number"
              value={person.ssBenefitAtFra}
              onChange={(e) => onChange({ ...person, ssBenefitAtFra: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>
              Planned claim age
              <HelpButton title="Planned claim age">
                <p>
                  The age at which you plan to start Social Security. Allowed: 62–70.
                </p>
                <p>
                  The optimizer also probes alternate claim ages (e.g. delay to 70 for higher lifetime benefit,
                  or accelerate to 62 to reduce withdrawals from accounts) and surfaces the best as a "Delay
                  SS" strategy. Your value here is the baseline.
                </p>
                <p>
                  <strong>Common choices:</strong> 62 (earliest, ~30% reduction), 65 (Medicare-eligibility year),
                  FRA (66–67 depending on birth year), 70 (maximum delayed credit, ~24–32% bonus vs. FRA).
                </p>
              </HelpButton>
            </label>
            <input
              type="number"
              min={62}
              max={70}
              value={person.ssClaimAge}
              onChange={(e) => onChange({ ...person, ssClaimAge: Number(e.target.value) })}
            />
          </div>
        </>
      )}
    </div>
  );
}
