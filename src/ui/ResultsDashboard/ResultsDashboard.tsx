import { useScenarioStore, lifetimeTotals } from '../../state/scenarioStore';
import { IncomeStackChart, MagiVsIrmaaChart, NetWorthChart, TaxStackChart } from '../Charts/Charts';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function ResultsDashboard() {
  const scenario = useScenarioStore((s) => s.scenario);
  const results = useScenarioStore((s) => s.currentResults);

  if (results.length === 0) {
    return (
      <div className="panel">
        <p>No results — fill in the inputs first.</p>
      </div>
    );
  }

  const totals = lifetimeTotals(results, scenario.assumptions.discountRate, scenario.startYear);
  const last = results[results.length - 1];

  return (
    <div>
      <div className="cards">
        <Card label="Lifetime spending covered" value={fmt(totals.lifetimeAfterTax)} />
        <Card label="Lifetime tax paid" value={fmt(totals.lifetimeTax)} />
        <Card label={`Ending net worth (${last.year})`} value={fmt(totals.endingNetWorth)} />
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
                    {r.cashShortfall > 0 ? fmt(r.cashShortfall) : '—'}
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
