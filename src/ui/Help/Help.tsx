export function Help() {
  return (
    <div className="help">
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>What this tool does</h2>
        <p>
          Projects your household's finances year-by-year from today through the end of your plan, applying
          federal + state income tax, Required Minimum Distributions, Medicare IRMAA surcharges, Social Security
          taxability and claim-age rules, NIIT, and inherited-asset tax treatment. An optimizer then searches
          combinations of Roth conversions, Social Security claim ages, and withdrawal policies to suggest
          alternative plans ranked by after-heir-tax lifetime outcome.
        </p>
        <div className="warning" style={{ marginTop: 12 }}>
          <strong>Privacy:</strong> everything runs in your browser. No scenario data is ever sent to a server.
          Save/Load JSON writes and reads files on your own machine. The only way any of your data leaves this
          browser is if you deliberately copy the AI-prompt export into a chat tool.
        </div>
      </div>

      <div className="panel">
        <h2>Quick start</h2>
        <ol style={{ paddingLeft: 20 }}>
          <li>
            <strong>Inputs</strong> → walk through Household, Accounts, Income, Spending, Assumptions. Defaults
            are reasonable; override anything that doesn't match you.
          </li>
          <li>
            <strong>Results</strong> → scan the summary cards, charts, and year-by-year table. These reflect
            your current plan with no optimization applied.
          </li>
          <li>
            <strong>Strategies</strong> → click "Run optimizer." Each alternative shows exact actions and the
            reasoning. Click "Apply & view" on one to load it into your plan and see the effect on Results.
          </li>
          <li>
            <strong>Save JSON</strong> in the top toolbar to stash your scenario for next time. "Load JSON…"
            restores it.
          </li>
        </ol>
      </div>

      <div className="panel">
        <h2>Toolbar</h2>
        <dl className="help-dl">
          <dt>Load JSON…</dt>
          <dd>
            Opens a file picker. Select a file you previously saved. The app validates the schema before
            overwriting the current scenario.
          </dd>
          <dt>Save JSON</dt>
          <dd>
            Downloads your current scenario as a timestamped JSON file. Only your inputs are saved - results
            are recomputed every time.
          </dd>
          <dt>Export AI prompt…</dt>
          <dd>
            Builds a Markdown block containing your scenario and any strategy results. Copy and paste it into
            ChatGPT, Claude, Gemini, etc. for a second opinion. Review before sending - pasting sends your
            financial data to that provider.
          </dd>
          <dt>Clear all data</dt>
          <dd>
            Wipes every field back to a blank slate after a confirmation. Save JSON first if you want to come
            back to your current plan.
          </dd>
        </dl>
      </div>

      <div className="panel">
        <h2>Inputs</h2>

        <h3>Household</h3>
        <p>
          Filing status, primary and optional spouse (birth year, state, Full-Retirement-Age Social Security
          benefit, planned claim age), and plan end age. Claim age 62–70; FRA is 67 and each month early/late
          adjusts the benefit per the SSA formula.
        </p>

        <h3>Accounts</h3>
        <p>
          Owner, type, label, balance, after-tax basis, and expected annual return per account. Supported
          types:
        </p>
        <ul>
          <li><strong>traditional-ira / traditional-401k</strong> - pre-tax retirement accounts. RMDs apply at the age set by SECURE 2.0 (73 or 75).</li>
          <li><strong>roth-ira / roth-401k</strong> - after-tax retirement. No RMDs for the owner; withdrawals tax-free post-59½.</li>
          <li><strong>taxable</strong> - regular brokerage. Withdrawals realize pro-rata long-term capital gain.</li>
          <li><strong>hsa</strong> - modeled like traditional for tax purposes in this tool.</li>
        </ul>
        <p>
          <strong>Basis</strong> (after-tax dollars inside the account):
        </p>
        <ul>
          <li>Traditional IRA/401(k): non-deductible contributions tracked on Form 8606. Leave blank if all pre-tax - that's most people. If you made non-deductible contributions (common for high earners above the IRA deduction phase-out, or "backdoor Roth" practitioners), enter the cumulative basis. The pro-rata rule (IRC §72) applies on withdrawals and Roth conversions.</li>
          <li>Taxable: cost basis. Leave blank to assume basis = balance (no unrealized gains).</li>
          <li>Roth: ignored.</li>
        </ul>

        <h3>Income streams</h3>
        <p>
          Anything taxable that isn't Social Security: salary, pension, rental, other. Each stream has a start
          year and optional end year. COLA defaults to 2%. Social Security is entered per-person on the
          Household step - don't add it here.
        </p>

        <h3>Spending</h3>
        <p>
          <strong>Base annual spending</strong> in today's dollars; the engine inflates it each year.
          <strong> Pre-65 healthcare add-on</strong> is additional spending between retirement and Medicare
          eligibility (commonly ACA premiums).
        </p>

        <h3>Assumptions</h3>
        <p>
          <strong>Inflation</strong> drives both spending growth and (in future) tax-bracket indexing.
          <strong> Discount rate</strong> is used by the optimizer's present-value score - a higher rate
          weights near-term spending more heavily than distant ending wealth.
          <strong> Heir marginal tax rate</strong> estimates what your heirs would pay on inherited
          traditional IRA/401(k) withdrawals under the SECURE Act 10-year rule. Default 24% is typical for a
          middle-aged non-spouse beneficiary; set to 0 if you want ending net worth scored at face value
          (ignoring heir tax).
        </p>
      </div>

      <div className="panel">
        <h2>Results</h2>
        <p>
          Summary cards, four charts (net worth, income composition, taxes paid, MAGI-vs-IRMAA-tier bands),
          and a year-by-year table. If you've applied a strategy, a banner at the top names it and offers a
          Revert button; the numbers below reflect that strategy's conversion schedule and SS claim ages.
        </p>
        <p>
          <strong>Heirs receive after tax</strong> is the one card to watch if you care about legacy. Two
          plans can end with the same face-value net worth but leave very different amounts to heirs once
          ordinary-income tax on inherited traditional IRA dollars is factored in.
        </p>
      </div>

      <div className="panel">
        <h2>Strategies</h2>
        <p>
          "Run optimizer" kicks off a search across:
        </p>
        <ul>
          <li>Per-year Roth conversion amounts anchored at ordinary-income bracket tops and IRMAA tier ceilings.</li>
          <li>Social Security claim age per spouse (62–70 grid).</li>
          <li>Withdrawal order: conventional (taxable → traditional → Roth), proportional, or bracket-fill.</li>
        </ul>
        <p>
          The result is a baseline ("do nothing") plus three alternatives, ranked by score. Each card lists
          the specific actions and explains the economic logic. <strong>Apply & view</strong> loads the
          strategy into your plan and jumps to Results.
        </p>
      </div>

      <div className="panel">
        <h2>Glossary</h2>
        <dl className="help-dl">
          <dt>AGI / MAGI</dt>
          <dd>
            Adjusted Gross Income / Modified AGI. MAGI is AGI plus a few add-backs; we simplify by treating
            them equal in most places. IRMAA and NIIT thresholds key off MAGI.
          </dd>
          <dt>RMD (Required Minimum Distribution)</dt>
          <dd>
            Forced annual withdrawal from traditional IRA/401(k) once you reach applicable age (73 if born
            1951–1959, 75 if born 1960+). Computed from the IRS Uniform Lifetime Table. RMD amounts are
            ordinary income.
          </dd>
          <dt>Roth conversion</dt>
          <dd>
            Moving dollars from a traditional IRA to a Roth IRA. The pre-tax portion becomes ordinary income
            in the year of conversion. Once in the Roth, future growth and withdrawals are tax-free. Often
            valuable in low-income years between retirement and RMD age 73/75.
          </dd>
          <dt>Pro-rata rule (IRC §72)</dt>
          <dd>
            When you withdraw or convert from a traditional IRA that contains both pre-tax and after-tax
            (non-deductible) contributions, a proportional slice of each dollar is tax-free. Example: basis
            $50k in a $500k account means 10% of any distribution is return of basis.
          </dd>
          <dt>IRMAA</dt>
          <dd>
            Income-Related Monthly Adjustment Amount. Surcharges on Medicare Part B and D premiums for
            higher-income filers. Six tiers. Kicks in at MAGI above $106k single / $212k MFJ in 2025 and
            climbs steeply. Based on your tax return from <em>two years prior</em> - so 2025 premiums are
            driven by your 2023 MAGI.
          </dd>
          <dt>NIIT</dt>
          <dd>
            Net Investment Income Tax. Flat 3.8% on investment income (LTCG, dividends, rental) for MAGI
            above $200k single / $250k MFJ.
          </dd>
          <dt>LTCG stacking</dt>
          <dd>
            Long-term capital gains sit on top of ordinary income on the federal return. The LTCG 0% / 15% /
            20% bracket a given dollar lands in depends on where your ordinary income already sits.
          </dd>
          <dt>Step-up in basis</dt>
          <dd>
            When a taxable brokerage account is inherited, the heir's cost basis resets to fair market value
            at date of death. All lifetime unrealized gains become permanently tax-free. This is why the
            optimizer treats taxable-with-gain as a valuable thing to leave to heirs.
          </dd>
        </dl>
      </div>

      <div className="panel">
        <h2>What's <em>not</em> modeled</h2>
        <ul>
          <li>Monte Carlo / sequence-of-returns risk (deterministic projections only).</li>
          <li>Most state income taxes - currently CA, NY, PA, MD, plus FL/TX/WA (no tax). Request more or add them to <code>src/tables/states-2025.json</code>.</li>
          <li>Early-withdrawal penalty (10%) on retirement accounts before age 59½.</li>
          <li>Federal estate tax (exemption is ~$14M per person in 2025, rare).</li>
          <li>State inheritance tax.</li>
          <li>Qualified Charitable Distributions (QCDs) from IRAs at 70½+.</li>
          <li>Mega-backdoor-Roth from 401(k) after-tax contributions.</li>
          <li>Inherited IRA 10-year clock for the original owner's own beneficiaries (we model the heir tax as a one-shot rate on ending balance).</li>
          <li>ACA premium tax credits for early retirees below 65.</li>
          <li>Tax-law sunset scenarios beyond a simple flag (engine uses 2025 current-law tables).</li>
        </ul>
      </div>

      <div className="panel">
        <h2>Caveats</h2>
        <p>
          This is a planning tool, not tax preparation software or financial advice. The tax engine applies
          2025 federal rules and a simplified state model; state treatment in particular is approximated.
          Bracket indexing for future years uses constant CPI, which understates both bracket creep and
          IRMAA tier drift. Life is also more complicated than any model - use the output as a starting
          point for conversations with a fee-only CFP or tax professional.
        </p>
      </div>
    </div>
  );
}
