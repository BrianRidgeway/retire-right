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
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
        Owner · Type · Label · Balance · Expected return
      </div>
      {scenario.accounts.map((a) => (
        <div className="account-row" key={a.id}>
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
            step="0.001"
            value={a.expectedReturn}
            onChange={(e) => updateAccount(a.id, { expectedReturn: Number(e.target.value) })}
          />
          <button className="btn-sm btn-danger" onClick={() => removeAccount(a.id)}>
            ✕
          </button>
        </div>
      ))}
      <button onClick={addAccount} style={{ marginTop: 12 }}>
        + Add account
      </button>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
        For taxable accounts, cost basis defaults to balance if not set. Edit JSON directly for advanced fields.
      </div>
    </div>
  );
}
