const BMC_URL = 'https://www.buymeacoffee.com/retireright';
const GITHUB_URL = 'https://github.com/brianjridgeway/retire-right';

export function Landing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">Retire Right</div>
        <nav className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <button className="primary" onClick={onLaunch}>
            Launch planner →
          </button>
        </nav>
      </header>

      <section className="landing-hero">
        <h1>
          Plan retirement the way a <span className="accent">fee-only planner</span> would —
          without sharing your data.
        </h1>
        <p className="landing-sub">
          Retire Right models Roth conversions, RMDs, Medicare IRMAA surcharges, Social Security
          timing, federal and state tax, and heir-tax impact — all in your browser. Nothing leaves
          your computer. Free forever.
        </p>
        <div className="landing-cta">
          <button className="primary large" onClick={onLaunch}>
            Launch the planner
          </button>
          <a
            className="landing-btn-secondary"
            href={BMC_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            ☕ Buy me a coffee
          </a>
        </div>
        <div className="landing-pills">
          <span className="pill">✓ 100% local · no server</span>
          <span className="pill">✓ No signup · no email</span>
          <span className="pill">✓ Open source</span>
          <span className="pill">✓ Save as JSON</span>
        </div>
      </section>

      <section id="features" className="landing-features">
        <h2>What it actually models</h2>
        <div className="landing-feature-grid">
          <Feature
            title="Roth conversion optimizer"
            body="Searches per-year conversion amounts anchored at ordinary-income bracket tops and IRMAA tier ceilings. Tells you exactly how much to convert in each year and why."
          />
          <Feature
            title="Required Minimum Distributions"
            body="SECURE 2.0 applicable age (73 or 75 based on birth year), Uniform Lifetime Table divisors, pro-rata for non-deductible basis."
          />
          <Feature
            title="Medicare IRMAA surcharges"
            body="All six tiers for Part B and D, with the 2-year MAGI lookback most tools get wrong. Chart shows when you'll cross each threshold."
          />
          <Feature
            title="Social Security optimization"
            body="Grid search over claim ages 62-70 per spouse. Models benefit multipliers and the provisional-income taxability rules."
          />
          <Feature
            title="Heir-tax impact (SECURE Act)"
            body="Most tools report face-value ending net worth. Retire Right shows what your heirs actually receive after paying ordinary income tax on inherited traditional IRA dollars."
          />
          <Feature
            title="Pro-rata basis (IRC §72)"
            body="Non-deductible IRA contributions tracked as after-tax basis. Withdrawals and Roth conversions split pro-rata, matching Form 8606 treatment."
          />
          <Feature
            title="Federal + state + NIIT"
            body="2025 federal brackets with LTCG stacking; state tax for CA, NY, PA, MD (with county local); NIIT 3.8% above MAGI thresholds."
          />
          <Feature
            title="Plain-English actions"
            body="Every suggested strategy lists the specific dollar amounts to convert, the ages to claim SS, and the reasoning. Not just numbers — a plan."
          />
          <Feature
            title="AI-prompt export"
            body="One click to generate a Markdown summary of your scenario and strategies. Paste into ChatGPT, Claude, or Gemini for a second opinion — your choice, your data."
          />
        </div>
      </section>

      <section id="faq" className="landing-faq">
        <h2>FAQ</h2>

        <Faq q="Is my data really private?">
          Yes. Retire Right is a static single-page app. All computation runs in your browser.
          Save/Load JSON reads and writes files on your own machine. The only way your data
          leaves is if you copy the AI-prompt export into a third-party chat tool — and that's
          your choice, with a warning before you paste.
        </Faq>
        <Faq q="What does the Roth conversion optimizer actually do?">
          It searches per-year conversion amounts anchored at tax-bracket tops (12% / 22% /
          24%) and IRMAA tier ceilings. For each candidate it re-runs the full year-by-year
          projection and scores the result using present-value lifetime spending + after-heir-tax
          ending wealth. The top combinations are presented with the exact amounts per year.
        </Faq>
        <Faq q="Which states are supported?">
          California, New York, Pennsylvania, Maryland (with ~3% county local tax), and no-tax
          states (Florida, Texas, Washington). The state-tax engine is pluggable — more states
          can be added by editing a single JSON table.
        </Faq>
        <Faq q="How does it handle IRMAA?">
          Models all six Part B and Part D tiers with the 2-year MAGI lookback. This is the
          rule most planners get wrong: your 2025 Medicare premium is determined by your 2023
          MAGI, not your current-year MAGI. The optimizer uses IRMAA tier ceilings as natural
          anchors for Roth conversion amounts.
        </Faq>
        <Faq q="What about Monte Carlo / sequence-of-returns risk?">
          Not yet. The current engine is deterministic with fixed return assumptions. That's a
          deliberate MVP choice — it makes Roth conversion and IRMAA strategy explainable and
          reproducible. Monte Carlo is a planned feature.
        </Faq>
        <Faq q="Is this financial advice?">
          No. Retire Right is an educational modeling tool, not tax preparation software or
          personalized financial advice. For real decisions, work with a fee-only CFP or tax
          professional. Use the output and AI-prompt export as starting points for that
          conversation.
        </Faq>
        <Faq q="Can I support the project?">
          <>
            Yes — and thank you.{' '}
            <a href={BMC_URL} target="_blank" rel="noopener noreferrer">
              Buy me a coffee
            </a>{' '}
            supports ongoing work (annual tax-table updates, more states, Monte Carlo). The
            source is on{' '}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>{' '}
            if you want to audit the math or contribute.
          </>
        </Faq>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <strong>Retire Right</strong> · free, open, private
          </div>
          <div className="landing-footer-links">
            <a href={BMC_URL} target="_blank" rel="noopener noreferrer">
              ☕ Buy me a coffee
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <button className="landing-linklike" onClick={onLaunch}>
              Launch planner
            </button>
          </div>
        </div>
        <div className="landing-footer-legal">
          Educational tool. Not tax prep, not investment advice. Tax rules based on 2025 U.S.
          current law; verify with a professional before acting.
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="landing-feature">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="landing-faq-item">
      <summary>{q}</summary>
      <div className="landing-faq-body">{children}</div>
    </details>
  );
}
