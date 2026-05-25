import { useScenarioStore, lifetimeTotals } from '../../state/scenarioStore';
import { IncomeStackChart, MagiVsIrmaaChart, NetWorthChart, TaxStackChart } from '../Charts/Charts';
import { Scenario } from '../../types';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Derive the first retirement year from salary income streams.
 * Uses the latest salary endYear + 1. Reading from the scenario directly is more reliable
 * than scanning r.wages — wages can look zero in year 1 if a salary stream starts later,
 * causing the transition detector to fire at the wrong year.
 */
function retirementYearFromScenario(scenario: Scenario): number | null {
  const salaryEndYears = scenario.incomeStreams
    .filter((s) => s.kind === 'salary' && s.endYear != null && s.endYear >= scenario.startYear)
    .map((s) => s.endYear as number);
  if (salaryEndYears.length === 0) return null;
  return Math.max(...salaryEndYears) + 1;
}

export function ResultsDashboard() {
  const scenario = useScenarioStore((s) => s.scenario);
  const results = useScenarioStore((s) => s.currentResults);
  const update = useScenarioStore((s) => s.updateScenario);

  if (results.length === 0) {
    return (
      <div className="panel">
        <p>No results - fill in the inputs first.</p>
      </div>
    );
  }

  const totals = lifetimeTotals(results, scenario.assumptions.discountRate, scenario.startYear);
  const last = results[results.length - 1];
  const retYear = retirementYearFromScenario(scenario);
  const retRow = retYear != null ? results.find((r) => r.year === retYear) ?? null : null;
  const yearsToRetirement = retYear != null ? retYear - scenario.startYear : null;
  const hasActiveStrategy =
    Object.keys(scenario.strategy.rothConversions).length > 0 ||
    Object.keys(scenario.strategy.ssClaimAges).length > 0 ||
    scenario.strategy.withdrawalPolicy !== 'conventional';
  const heirGap = totals.endingNetWorth - totals.endingHeirNetWorth;
  const zeroReturnAccounts = scenario.accounts.filter((a) => a.balance > 0 && a.expectedReturn <= 0);

  const revertStrategy = () =>
    update((s) => ({
      ...s,
      strategy: {
        rothConversions: {},
        withdrawalPolicy: 'conventional',
        ssClaimAges: {},
        label: 'Current plan',
      },
    }));

  return (
    <div>
      {hasActiveStrategy && (
        <div
          className="panel"
          style={{
            borderColor: 'var(--accent)',
            background: 'rgba(94,234,212,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <strong style={{ color: 'var(--accent)' }}>Viewing strategy: {scenario.strategy.label}</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              The numbers and charts below reflect this strategy's conversion schedule, SS claim ages, and
              withdrawal policy. Revert to go back to your untouched inputs.
            </div>
          </div>
          <button onClick={revertStrategy}>Revert to current plan</button>
        </div>
      )}

      {zeroReturnAccounts.length > 0 && (
        <div className="panel" style={{ borderColor: 'var(--warn, #d97706)', background: 'rgba(217,119,6,0.08)' }}>
          <strong style={{ color: 'var(--warn, #d97706)' }}>Expected return is 0% on {zeroReturnAccounts.length} account{zeroReturnAccounts.length > 1 ? 's' : ''}: {zeroReturnAccounts.map((a) => a.label).join(', ')}.</strong>
          {' '}These accounts won't grow — go to Inputs → Accounts and set a non-zero Expected Return (e.g. 0.06 for 6%).
        </div>
      )}

      <div className="cards">
        <Card label="Lifetime spending covered" value={fmt(totals.lifetimeAfterTax)} />
        <Card label="Lifetime tax paid" value={fmt(totals.lifetimeTax)} />
        {retRow && (
          <Card
            label={`At retirement (${retRow.year}, age ${retRow.primaryAge})`}
            value={fmt(retRow.netWorthEoy)}
            sub={
              yearsToRetirement != null && yearsToRetirement <= 1
                ? `⚠ Only ${yearsToRetirement} year(s) of pre-retirement growth — check salary End Year on the Income tab`
                : `After ${yearsToRetirement} years of growth + contributions from ${scenario.startYear}`
            }
            bad={yearsToRetirement != null && yearsToRetirement <= 1}
          />
        )}
        <Card label={`Ending net worth (${last.year})`} value={fmt(totals.endingNetWorth)} />
        <Card
          label="Heirs receive after tax"
          value={fmt(totals.endingHeirNetWorth)}
          sub={
            heirGap > 0
              ? `${fmt(heirGap)} lost to heir income tax on inherited traditional IRA/401(k)`
              : 'No heir income tax (all Roth/taxable/stepped-up)'
          }
        />
        <Card
          label="Any shortfall?"
          value={totals.anyShortfall ? 'Yes' : 'No'}
          sub={totals.anyShortfall ? 'Check cash shortfall column' : 'Plan covers all years'}
          bad={totals.anyShortfall}
        />
      </div>

      <div className="panel">
        <h2>Net worth over time</h2>
        <NetWorthChart results={results} status={scenario.household.filingStatus} />
      </div>

      <div className="panel">
        <h2>Income composition</h2>
        <IncomeStackChart results={results} status={scenario.household.filingStatus} />
      </div>

      <div className="panel">
        <h2>Taxes paid each year</h2>
        <TaxStackChart results={results} status={scenario.household.filingStatus} />
      </div>

      <div className="panel">
        <h2>MAGI vs IRMAA tier thresholds</h2>
        <MagiVsIrmaaChart results={results} status={scenario.household.filingStatus} />
      </div>

      <div className="panel">
        <h2>Year-by-year</h2>
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          <table className="year-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Age</th>
                <th>AGI</th>
                <th>MAGI</th>
                <th>Fed tax</th>
                <th>State tax</th>
                <th>NIIT</th>
                <th>IRMAA</th>
                <th>RMD</th>
                <th>Roth conv</th>
                <th>Net worth</th>
                <th>Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  <td>
                    {r.primaryAge}
                    {r.spouseAge != null ? `/${r.spouseAge}` : ''}
                  </td>
                  <td>{fmt(r.agi)}</td>
                  <td>{fmt(r.magiIrmaa)}</td>
                  <td>{fmt(r.federalTax)}</td>
                  <td>{fmt(r.stateTax)}</td>
                  <td>{fmt(r.niitTax)}</td>
                  <td>{fmt(r.irmaaAnnual)}</td>
                  <td>{fmt(r.rmdRequired)}</td>
                  <td>{fmt(r.rothConversion)}</td>
                  <td>{fmt(r.netWorthEoy)}</td>
                  <td className={r.cashShortfall > 0 ? 'err' : ''}>
                    {r.cashShortfall > 0 ? fmt(r.cashShortfall) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-value" style={{ color: bad ? 'var(--bad)' : undefined }}>
        {value}
      </div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}
