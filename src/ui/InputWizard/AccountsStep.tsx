import { useScenarioStore } from '../../state/scenarioStore';
import { Account, ACCOUNT_TYPES, AccountType } from '../../types';

export function AccountsStep() {
  const scenario = useScenarioStore((s) => s.scenario);
  const update = useScenarioStore((s) => s.updateScenario);

  const owners = [scenario.household.primary, scenario.household.spouse].filter(Boolean);

  const setAccounts = (fn: (list: Account[]) => Account[]) =>
    update((s) => ({ ...s, accounts: fn(s.accounts) }));

  const addAccount = () => {
    const id = `acc-${Date.now()}`;
    setAccounts((list) => [
      ...list,
      {
        id,
        ownerId: scenario.household.primary.id,
        type: 'traditional-ira',
        label: 'New account',
        balance: 0,
        expectedReturn: 0.06,
        annualContribution: 0,
      },
    ]);
  };

  const updateAccount = (id: string, patch: Partial<Account>) => {
    setAccounts((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeAccount = (id: string) => setAccounts((list) => list.filter((a) => a.id !== id));

  return (
    <div className="panel">
      <h2>Accounts</h2>

      <div className="account-row table-header">
        <div>Owner</div>
        <div>Type</div>
        <div>Label</div>
        <div>Balance</div>
        <div title="Taxable: cost basis. Traditional: after-tax (non-deductible Form 8606) basis. Roth: ignored.">
          Basis
        </div>
        <div>Exp. return</div>
        <div></div>
      </div>

      {scenario.accounts.map((a) => {
        const mix = a.assetMix ?? { equitiesPct: 1, bondsPct: 0, reitsPct: 0 };
        const setMix = (patch: Partial<typeof mix>) =>
          updateAccount(a.id, { assetMix: { ...mix, ...patch } });
        return (
          <div key={a.id}>
            <div className="account-row">
              <select value={a.ownerId} onChange={(e) => updateAccount(a.id, { ownerId: e.target.value })}>
                {owners.map((o) => (
                  <option key={o!.id} value={o!.id}>
                    {o!.name}
                  </option>
                ))}
              </select>
              <select
                value={a.type}
                onChange={(e) => updateAccount(a.id, { type: e.target.value as AccountType })}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input value={a.label} onChange={(e) => updateAccount(a.id, { label: e.target.value })} />
              <input
                type="number"
                value={a.balance}
                onChange={(e) => updateAccount(a.id, { balance: Number(e.target.value) })}
              />
              <input
                type="number"
                value={a.costBasis ?? ''}
                placeholder={defaultBasisPlaceholder(a)}
                disabled={a.type === 'roth-ira' || a.type === 'roth-401k'}
                onChange={(e) =>
                  updateAccount(a.id, {
                    costBasis: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
              <input
                type="number"
                step="0.001"
                value={a.expectedReturn}
                onChange={(e) => updateAccount(a.id, { expectedReturn: Number(e.target.value) })}
              />
              <button className="btn-sm btn-danger" onClick={() => removeAccount(a.id)}>
                ✕
              </button>
            </div>
            <div style={{ paddingLeft: 8, marginTop: 4, marginBottom: 8, fontSize: 12, color: 'var(--text-dim)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Asset mix:</span>
              <label>
                Equities%{' '}
                <input
                  type="number"
                  min={0}
                  max={1}
                  step="0.05"
                  style={{ width: 60 }}
                  value={mix.equitiesPct}
                  onChange={(e) => setMix({ equitiesPct: Number(e.target.value) })}
                />
              </label>
              <label>
                Bonds%{' '}
                <input
                  type="number"
                  min={0}
                  max={1}
                  step="0.05"
                  style={{ width: 60 }}
                  value={mix.bondsPct}
                  onChange={(e) => setMix({ bondsPct: Number(e.target.value) })}
                />
              </label>
              <label>
                REITs%{' '}
                <input
                  type="number"
                  min={0}
                  max={1}
                  step="0.05"
                  style={{ width: 60 }}
                  value={mix.reitsPct}
                  onChange={(e) => setMix({ reitsPct: Number(e.target.value) })}
                />
              </label>
              {a.type === 'taxable' && (
                <span style={{ color: 'var(--accent)' }}>
                  ← bonds/REITs here create annual ordinary-income tax drag; move them into traditional IRA if possible.
                </span>
              )}
            </div>
          </div>
        );
      })}
      <button onClick={addAccount} style={{ marginTop: 12 }}>
        + Add account
      </button>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        <div><strong>Basis</strong> (after-tax dollars inside the account):</div>
        <div>· <strong>Traditional IRA / 401(k):</strong> non-deductible contributions per Form 8606. Leave blank if all pre-tax (most people). If you have non-deductible contributions, enter the cumulative basis - the pro-rata rule (IRC §72) is applied on withdrawals and Roth conversions.</div>
        <div>· <strong>Taxable brokerage:</strong> cost basis. If blank, we assume basis = balance (no unrealized gains).</div>
        <div>· <strong>Roth:</strong> not used - withdrawals are fully tax-free (post-59½).</div>
      </div>
    </div>
  );
}

function defaultBasisPlaceholder(a: Account): string {
  if (a.type === 'roth-ira' || a.type === 'roth-401k') return 'n/a';
  if (a.type === 'taxable') return '= balance';
  return '0 (all pre-tax)';
}
