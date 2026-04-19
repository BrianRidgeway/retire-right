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
          policies against your current plan. Each strategy shows the specific actions you'd take and why it helps.
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
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Ranked by score (present value of lifetime spending covered + ending net worth). Each card lists the
          specific actions to take and the reasoning.
        </div>
      </div>

      <StrategySection title="Baseline — your current plan" strategies={[baseline]} baseline={baseline} onApply={applyStrategy} />
      <StrategySection title="Alternatives" strategies={ranked} baseline={baseline} onApply={applyStrategy} highlightFirst />
    </div>
  );
}

function StrategySection({
  title,
  strategies,
  baseline,
  onApply,
  highlightFirst,
}: {
  title: string;
  strategies: StrategyResult[];
  baseline: StrategyResult;
  onApply: (fn: (s: any) => any) => void;
  highlightFirst?: boolean;
}) {
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {strategies.map((r, i) => (
          <StrategyCard
            key={i}
            r={r}
            baseline={baseline}
            best={highlightFirst && i === 0}
            onApply={() => onApply((s: any) => ({ ...s, strategy: r.strategy }))}
          />
        ))}
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
  const isBaseline = r === baseline;

  return (
    <div className={`strategy-card ${best ? 'best' : ''}`} style={{ display: 'block' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: 0 }}>
            {r.strategy.label}
            {best && <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 8 }}>★ best</span>}
          </h4>
          {!isBaseline && (
            <div className={`delta ${delta >= 0 ? 'pos' : 'neg'}`} style={{ marginTop: 4 }}>
              {delta >= 0 ? '+' : '−'}{fmt(Math.abs(delta))}{' '}
              <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>vs baseline (lifetime + ending)</span>
            </div>
          )}
        </div>
        {!isBaseline && (
          <button className="primary" onClick={onApply}>
            Apply
          </button>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 4 }}>
          What to do
        </div>
        <ul style={{ marginTop: 0, paddingLeft: 18, fontSize: 13 }}>
          {r.actions.map((a, i) => (
            <li key={i} style={a.startsWith('  •') ? { listStyle: 'none', marginLeft: -18, color: 'var(--text-dim)' } : undefined}>
              {a.replace(/^\s+•\s*/, '')}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 8 }}>
        <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 4 }}>
          Why
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r.rationale}</div>
      </div>

      <div className="grid-3" style={{ marginTop: 12, fontSize: 12 }}>
        <div>
          <div className="muted">Lifetime spending</div>
          <div>{fmt(r.lifetimeAfterTax)}</div>
        </div>
        <div>
          <div className="muted">Lifetime tax</div>
          <div>{fmt(r.lifetimeTax)}</div>
        </div>
        <div>
          <div className="muted">Ending net worth</div>
          <div>{fmt(r.endingNetWorth)}</div>
        </div>
      </div>

      {(r.pros.length > 0 || r.cons.length > 0) && (
        <div className="grid-2" style={{ marginTop: 12, gap: 16 }}>
          {r.pros.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--good)', textTransform: 'uppercase', letterSpacing: 0.05 }}>
                Pros
              </div>
              <ul style={{ marginTop: 4, paddingLeft: 18, fontSize: 12, color: 'var(--text-dim)' }}>
                {r.pros.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {r.cons.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--bad)', textTransform: 'uppercase', letterSpacing: 0.05 }}>
                Cons
              </div>
              <ul style={{ marginTop: 4, paddingLeft: 18, fontSize: 12, color: 'var(--text-dim)' }}>
                {r.cons.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
