import { useScenarioStore } from '../../state/scenarioStore';
import { IncomeStream } from '../../types';
import { HelpButton } from '../HelpButton/HelpButton';

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
        survivorPct: 1,
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

      <div className="income-row table-header">
        <div>
          Label
          <HelpButton title="Income stream label">
            <p>Free-text name shown in charts/tables. Examples: "Salary (Alex)", "Federal pension", "Rental: 123 Main St".</p>
          </HelpButton>
        </div>
        <div>
          Kind
          <HelpButton title="Income kind">
            <p><strong>salary</strong>: W-2 wages, taxed as ordinary income, subject to SS/Medicare via payroll (the engine doesn't deduct payroll tax — assume gross). Ends if the owner dies under the survivor scenario.</p>
            <p><strong>pension</strong>: defined-benefit retirement income, taxed as ordinary income (use Taxable% if partially after-tax). Has a survivor election (next field) — the survivor receives `survivorPct` × the original after the owner dies.</p>
            <p><strong>rental</strong>: rental property net income, taxed as ordinary income but flagged as net investment income for NIIT (3.8% on MAGI above $250K MFJ / $200K single).</p>
            <p><strong>other</strong>: catch-all (royalties, board fees, etc.). Treated as rental for tax purposes.</p>
          </HelpButton>
        </div>
        <div>
          Annual $
          <HelpButton title="Annual amount">
            <p>Annual amount in today's dollars. The engine inflates by the COLA each year from the start year. Enter the <em>annual</em> figure (multiply monthly by 12).</p>
          </HelpButton>
        </div>
        <div>
          Start year
          <HelpButton title="Income start year">
            <p>First calendar year this income stream pays out. For ongoing streams that started before plan start, use the actual original start year — the COLA factor is computed from there forward.</p>
          </HelpButton>
        </div>
        <div>
          End year
          <HelpButton title="Income end year">
            <p>Last year this stream pays out (inclusive). Leave blank for indefinite streams (pensions for life, perpetual rental).</p>
            <p>For salaries with a known retirement year, set this to the year you'll stop working. For a survivor's pension that ends at the owner's death, leave blank — the survivor scenario handles the multiplier automatically.</p>
          </HelpButton>
        </div>
        <div></div>
      </div>

      {scenario.incomeStreams.map((s) => (
        <div key={s.id}>
          <div className="income-row">
            <input value={s.label} onChange={(e) => updateStream(s.id, { label: e.target.value })} />
            <select
              value={s.kind}
              onChange={(e) => updateStream(s.id, { kind: e.target.value as IncomeStream['kind'] })}
            >
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
              placeholder="-"
              onChange={(e) =>
                updateStream(s.id, { endYear: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
            <button className="btn-sm btn-danger" onClick={() => removeStream(s.id)}>
              ✕
            </button>
          </div>
          {s.kind === 'pension' && (
            <div style={{ paddingLeft: 8, marginTop: 4, marginBottom: 8, fontSize: 12, color: 'var(--text-dim)' }}>
              <label>
                Survivor benefit fraction (J&S election):
                <HelpButton title="Pension survivor election">
                  <p>
                    The Joint & Survivor election made at pension start. After the pension owner dies, the
                    surviving spouse receives <code>survivorPct × original pension</code> for the rest of their
                    life. Only used by the <em>survivor scenario</em>; doesn't affect base-case math.
                  </p>
                  <p><strong>Common choices:</strong></p>
                  <ul>
                    <li><strong>100%</strong>: full pension continues to survivor — highest survivor protection, lowest while-both-alive payout.</li>
                    <li><strong>75%</strong> or <strong>50%</strong>: middle ground; payouts roughly 5–10% higher while both alive.</li>
                    <li><strong>0% (single-life)</strong>: maximum payout while owner alive, nothing for survivor — chosen when survivor has independent income, or when the pension premium for J&S was higher than the cost of equivalent life insurance.</li>
                  </ul>
                  <p>
                    Get this from your pension paperwork — usually elected at retirement and irrevocable. If you
                    don't know, default 100% is the safe assumption for survivor-scenario modeling.
                  </p>
                </HelpButton>
              </label>
              <select
                value={String(s.survivorPct ?? 1)}
                onChange={(e) => updateStream(s.id, { survivorPct: Number(e.target.value) })}
              >
                <option value="0">0% (single-life)</option>
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="1">100% (full J&S)</option>
              </select>
              <span style={{ marginLeft: 8 }}>
                Used in the survivor scenario only — what fraction of this pension continues after the owner dies.
              </span>
            </div>
          )}
        </div>
      ))}
      <button onClick={addStream} style={{ marginTop: 12 }}>
        + Add income stream
      </button>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
        Social Security is entered per-person on the Household step. End year can be left blank for indefinite streams.
      </div>
    </div>
  );
}
