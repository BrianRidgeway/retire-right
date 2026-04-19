import { useScenarioStore } from '../../state/scenarioStore';
import { IncomeStream } from '../../types';

export function IncomeStep() {
  const scenario = useScenarioStore((s) => s.scenario);
  const update = useScenarioStore((s) => s.updateScenario);

  const setStreams = (fn: (list: IncomeStream[]) => IncomeStream[]) =>
    update((s) => ({ ...s, incomeStreams: fn(s.incomeStreams) }));

  const addStream = () => {
    const id = `inc-${Date.now()}`;
    setStreams((list) => [
      ...list,
      {
        id,
        label: 'New income',
        kind: 'salary',
        annualAmount: 0,
        taxablePercent: 1,
        startYear: scenario.startYear,
        cola: 0.02,
      },
    ]);
  };

  const updateStream = (id: string, patch: Partial<IncomeStream>) => {
    setStreams((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeStream = (id: string) => setStreams((list) => list.filter((a) => a.id !== id));

  return (
    <div className="panel">
      <h2>Income streams (outside SS)</h2>
      {scenario.incomeStreams.map((s) => (
        <div className="income-row" key={s.id}>
          <input value={s.label} onChange={(e) => updateStream(s.id, { label: e.target.value })} />
          <select value={s.kind} onChange={(e) => updateStream(s.id, { kind: e.target.value as IncomeStream['kind'] })}>
            <option value="salary">salary</option>
            <option value="pension">pension</option>
            <option value="rental">rental</option>
            <option value="other">other</option>
          </select>
          <input
            type="number"
            value={s.annualAmount}
            onChange={(e) => updateStream(s.id, { annualAmount: Number(e.target.value) })}
          />
          <input
            type="number"
            value={s.startYear}
            onChange={(e) => updateStream(s.id, { startYear: Number(e.target.value) })}
          />
          <input
            type="number"
            value={s.endYear ?? ''}
            placeholder="end yr"
            onChange={(e) =>
              updateStream(s.id, { endYear: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
          <button className="btn-sm btn-danger" onClick={() => removeStream(s.id)}>
            ✕
          </button>
        </div>
      ))}
      <button onClick={addStream} style={{ marginTop: 12 }}>
        + Add income stream
      </button>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
        Social Security is entered per-person on the Household step.
      </div>
    </div>
  );
}
