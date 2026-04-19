import { useScenarioStore } from '../../state/scenarioStore';
import { StrategyResult } from '../../types';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function StrategyCompare() {
  const optimizerResults = useScenarioStore((s) => s.optimizerResults);
  const running = useScenarioStore((s) => s.optimizerRunning);
  const runOptimizer = useScenarioStore((s) => s.runOptimizer);
  const applyStrategy = useScenarioStore((s) => s.updateScenario);

  if (running) {
    return (
      <div className="panel">
        <p>Running optimizer… this can take a few seconds on larger scenarios.</p>
      </div>
    );
  }

  if (!optimizerResults) {
    return (
      <div className="panel">
        <h2>Strategies</h2>
        <p className="muted">
          Run the optimizer to compare Roth conversion ladders, Social Security claim timing, and withdrawal-order
          policies against your current plan.
        </p>
        <button className="primary" onClick={() => runOptimizer()}>
          Run optimizer
        </button>
      </div>
    );
  }

  const baseline = optimizerResults[0];
  const ranked = optimizerResults.slice(1);

  return (
    <div>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Strategies</h2>
          <button onClick={() => runOptimizer()}>Re-run</button>
        </div>
      </div>
      <div className="panel">
        <h3>Baseline (do nothing)</h3>
        <StrategyCard r={baseline} baseline={baseline} onApply={() => applyStrategy((s) => ({ ...s, strategy: baseline.strategy }))} />
      </div>
      <div className="panel">
        <h3>Alternatives</h3>
        <div className="strategy-grid">
          {ranked.map((r, i) => (
            <StrategyCard
              key={i}
              r={r}
              baseline={baseline}
              best={i === 0}
              onApply={() => applyStrategy((s) => ({ ...s, strategy: r.strategy }))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StrategyCard({
  r,
  baseline,
  best,
  onApply,
}: {
  r: StrategyResult;
  baseline: StrategyResult;
  best?: boolean;
  onApply: () => void;
}) {
  const delta = r.lifetimeAfterTax - baseline.lifetimeAfterTax + (r.endingNetWorth - baseline.endingNetWorth);
  return (
    <div className={`strategy-card ${best ? 'best' : ''}`}>
      <h4>{r.strategy.label} {best && <span style={{ color: 'var(--accent)', fontSize: 11 }}>★ best</span>}</h4>
      <div className={`delta ${delta >= 0 ? 'pos' : 'neg'}`}>
        {delta >= 0 ? '+' : '−'}{fmt(Math.abs(delta))}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        lifetime + ending vs baseline
      </div>
      <div style={{ fontSize: 12, marginTop: 8 }}>
        <div>Lifetime spending covered: {fmt(r.lifetimeAfterTax)}</div>
        <div>Lifetime tax: {fmt(r.lifetimeTax)}</div>
        <div>Ending net worth: {fmt(r.endingNetWorth)}</div>
      </div>
      {r.pros.length > 0 && (
        <>
          <div style={{ fontSize: 12, marginTop: 8, color: 'var(--good)' }}>Pros</div>
          <ul>
            {r.pros.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}
      {r.cons.length > 0 && (
        <>
          <div style={{ fontSize: 12, marginTop: 8, color: 'var(--bad)' }}>Cons</div>
          <ul>
            {r.cons.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}
      <div style={{ marginTop: 10 }}>
        <button onClick={onApply}>Apply this strategy</button>
      </div>
    </div>
  );
}
