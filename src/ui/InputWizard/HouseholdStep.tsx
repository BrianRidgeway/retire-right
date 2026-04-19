import { useScenarioStore } from '../../state/scenarioStore';
import { supportedStates } from '../../engine/tax/state';
import { FilingStatus, Person } from '../../types';

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
              ssBenefitAt67: 30000,
              ssClaimAge: 67,
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
          <label>Filing status</label>
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
          <label>Plan end age (both spouses)</label>
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

      <h3>Start year</h3>
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
        <label>Birth year</label>
        <input
          type="number"
          value={person.birthYear}
          onChange={(e) => onChange({ ...person, birthYear: Number(e.target.value) })}
        />
      </div>
      <div className="field">
        <label>State</label>
        <select value={person.state} onChange={(e) => onChange({ ...person, state: e.target.value })}>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>SS benefit at age 67 (annual)</label>
        <input
          type="number"
          value={person.ssBenefitAt67}
          onChange={(e) => onChange({ ...person, ssBenefitAt67: Number(e.target.value) })}
        />
      </div>
      <div className="field">
        <label>Planned claim age</label>
        <input
          type="number"
          min={62}
          max={70}
          value={person.ssClaimAge}
          onChange={(e) => onChange({ ...person, ssClaimAge: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
