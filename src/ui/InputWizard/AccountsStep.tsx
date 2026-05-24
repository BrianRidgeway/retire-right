import { useScenarioStore } from '../../state/scenarioStore';
import { Account, ACCOUNT_TYPES, AccountType } from '../../types';
import { HelpButton } from '../HelpButton/HelpButton';

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
        <div>
          Owner
          <HelpButton title="Account owner">
            <p>
              Which spouse owns this account. Affects RMD age (each spouse has their own based on birth year),
              Roth conversion eligibility (conversions only operate on the primary's traditional accounts at
              present), QCD eligibility (each spouse must be 70.5+ to QCD from their own IRA), and the
              spousal-rollover transfer after a survivor event.
            </p>
          </HelpButton>
        </div>
        <div>
          Type
          <HelpButton title="Account type">
            <p><strong>traditional-ira / traditional-401k</strong>: pre-tax. Withdrawals taxed as ordinary income; subject to RMDs starting at age 73 or 75 (SECURE 2.0); convertible to Roth.</p>
            <p><strong>roth-ira / roth-401k</strong>: post-tax contributions, tax-free growth and withdrawals (after 59½ and 5-year rule). No RMDs. Heirs receive tax-free.</p>
            <p><strong>taxable</strong>: regular brokerage. Annual yield (dividends/interest) hits AGI; price appreciation is unrealized LTCG. Cost basis steps up at death (heirs avoid capital gains).</p>
            <p><strong>hsa</strong>: triple tax-advantaged for qualified medical expenses. After 65, non-medical withdrawals taxed as ordinary income (no penalty). Reimburses Medicare premiums tax-free.</p>
          </HelpButton>
        </div>
        <div>
          Label
          <HelpButton title="Account label">
            <p>
              Free-text description shown in charts and tables (e.g. "Fidelity Rollover IRA", "Schwab brokerage",
              "401(k) at Acme Inc"). Doesn't affect calculations.
            </p>
          </HelpButton>
        </div>
        <div>
          Balance
          <HelpButton title="Account balance">
            <p>
              Current balance in dollars (end of last business day, or today). The engine grows it by your
              Expected Return each year and tracks withdrawals/conversions/RMDs against it.
            </p>
            <p>
              For taxable accounts: enter the full market value. The cost basis is tracked separately so
              unrealized capital gains can step up at death for heirs.
            </p>
          </HelpButton>
        </div>
        <div>
          Basis
          <HelpButton title="Cost basis">
            <p>By account type:</p>
            <ul>
              <li><strong>traditional IRA / 401(k)</strong>: <em>after-tax basis</em> from non-deductible contributions (Form 8606). Leave blank if all pre-tax (most people). If you've made non-deductible contributions, enter the cumulative basis — the pro-rata rule (IRC §72) is applied to withdrawals and Roth conversions so the basis portion isn't double-taxed.</li>
              <li><strong>taxable brokerage</strong>: cost basis. Balance minus basis = unrealized capital gains. Blank means basis = balance (no unrealized gains). This matters for both withdrawal tax (LTCG on the gain portion) and heir step-up modeling.</li>
              <li><strong>Roth / HSA</strong>: ignored.</li>
            </ul>
          </HelpButton>
        </div>
        <div>
          Exp. return
          <HelpButton title="Expected return">
            <p>
              Annual <em>total return</em> assumption (decimal: 0.06 = 6%). Includes price appreciation +
              dividends/interest. For taxable accounts the engine splits this into yield (taxed annually) and
              price appreciation (deferred) based on the asset mix.
            </p>
            <p>
              Typical conservative assumptions: 0.04–0.05 for bonds/CDs, 0.06–0.07 for diversified equities,
              0.05 for balanced 60/40. Be consistent across accounts unless you have specific allocations.
            </p>
          </HelpButton>
        </div>
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
              <span>
                Asset mix:
                <HelpButton title="Asset mix">
                  <p>
                    Fraction of this account held in each asset class. Should sum to 1.0. Drives:
                  </p>
                  <ul>
                    <li>
                      <strong>Annual tax drag</strong> on taxable accounts: bonds throw 100% of return as
                      ordinary interest, REITs throw 80% (mostly ordinary), equities throw ~30% as qualified
                      dividends. The yield hits AGI each year and bumps the account's basis (already taxed).
                    </li>
                    <li>
                      <strong>Asset-location concern</strong>: if you have bonds/REITs in taxable AND equities
                      in traditional IRA, the strategy cards suggest a swap — bonds/REITs belong in traditional
                      (no annual tax), equities belong in taxable + Roth (low yield, deferred appreciation).
                    </li>
                  </ul>
                  <p>
                    Default 100% equities. Set explicitly if you hold material bond or REIT allocations,
                    especially in taxable accounts (where the tax drag is largest).
                  </p>
                </HelpButton>
              </span>
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
