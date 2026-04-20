# Retire Right

> Free, privacy-first retirement planning calculator. Models Roth conversions, RMDs, Medicare IRMAA surcharges, Social Security timing, federal + state income tax, NIIT, and after-heir-tax estate value. Runs entirely in the browser.

**Live at [retireright.app](https://retireright.app).**

<p align="center">
  <img src="public/cover.png" alt="Retire Right - Private retirement planning. Nothing leaves your browser." width="800">
</p>

## Why this exists

Commercial retirement planners cost $100-200/year, typically require uploading your entire financial life to their servers, and hand you numbers without explaining *why* a strategy helps. Retire Right does the same math - federal + state tax, RMDs, IRMAA, NIIT, Social Security, heir-tax - and then tells you the specific actions to take in plain English, all in your browser. No signup. No backend. Free.

## Features

- **Roth conversion optimizer.** Searches per-year conversion amounts anchored at ordinary-income bracket tops and IRMAA tier ceilings. Output includes exact dollar amounts per year and the reasoning.
- **Required Minimum Distributions** under SECURE Act 2.0 (age 73 or 75 based on birth year), Uniform Lifetime Table divisors, with pro-rata handling for non-deductible basis (IRC §72 / Form 8606).
- **Medicare IRMAA.** All six Part B and Part D tiers with the 2-year MAGI lookback that most planners get wrong (your 2025 premium is based on your 2023 return).
- **Social Security timing.** Grid search over claim ages 62-70 per spouse, with benefit multipliers and provisional-income taxability rules.
- **Heir-tax modeling.** Accounts for the ordinary income tax non-spouse heirs pay on inherited traditional IRA/401(k) dollars under the SECURE Act 10-year rule, the step-up in basis that wipes unrealized gains on taxable brokerage accounts, and the tax-free passage of Roth.
- **Federal + state + NIIT.** 2025 federal ordinary and LTCG brackets with proper stacking. State tax for CA, NY, PA, MD (with ~3% county local surcharge), plus no-tax states (FL, TX, WA). NIIT 3.8% above MAGI thresholds.
- **Plain-English strategies.** Each suggestion lists the specific dollar amounts to convert, ages to claim SS, and the economic logic.
- **AI-prompt export.** One click to generate a Markdown summary of your scenario and strategies. Paste into ChatGPT, Claude, or Gemini for a second opinion - your choice, your data.
- **JSON save/load.** Your scenario is a single JSON file, stored wherever you want on your own machine.

## Privacy

Retire Right is a static single-page app. All calculations run in your browser after the page loads. The server (Cloudflare Pages) only serves static JavaScript, CSS, HTML, and the tax-table JSON. No scenario data, optimizer results, or identifying information is ever transmitted to a server. Save and Load JSON read and write files directly to your filesystem. The only way any of your financial data leaves your browser is if you deliberately copy the AI-prompt export into a third-party chat tool - and that requires an explicit click with a warning.

## How it works

The codebase has two layers:

**Engine** (`src/engine/*`, pure TypeScript, no React). Single deterministic function `runScenario(scenario) -> YearResult[]` runs the year-by-year simulation. Each year applies (in order): age, inflation, income streams, Social Security, RMDs, the strategy's Roth conversions, an iterative tax/withdrawal solve, federal tax with LTCG stacking, state tax, NIIT, IRMAA (using Y-2 MAGI), and account growth. The optimizer (`src/engine/optimizer/*`) is a coordinate-descent search over Roth conversion amounts, Social Security claim ages, and withdrawal-order policies that scores strategies by present value of lifetime spending plus after-heir-tax ending wealth.

**UI** (`src/ui/*`, React + Zustand). Input wizard, results dashboard (Recharts), strategy comparison cards, help page, and landing page. The landing page is the default view; `#app` in the URL boots the planner directly.

Tax tables live as versioned JSON in `src/tables/` and `public/tax-tables/`. Adding another state is an edit to `src/tables/states-2025.json` plus any state-specific quirks in `src/engine/tax/state.ts`.

## Development

Requires Node 20 or later.

```bash
git clone git@github.com:BrianRidgeway/retire-right.git
cd retire-right
npm ci
npm run dev        # http://localhost:5173
npm run test       # vitest, 76+ unit and integration tests
npm run build      # static bundle (file:// compatible), base './'
npm run build:deploy  # same but base '/' for root-domain hosting
```

Test suite covers federal + state tax brackets against IRS worked examples, IRMAA tier boundaries, SS taxability across all three tiers, RMD divisors at several ages, NIIT thresholds, basis pro-rata math, heir-tax calculations, and a golden end-to-end projection.

## Deploy

Primary target is Cloudflare Pages at the root domain. See [DEPLOY.md](./DEPLOY.md) for step-by-step instructions (both the GitHub-integrated auto-deploy path and the `wrangler`-based direct-upload path).

## What's *not* modeled

Calibrate your trust accordingly.

- Monte Carlo / sequence-of-returns risk. Engine is deterministic with fixed expected returns.
- Most state income taxes. Currently CA, NY, PA, MD, plus FL/TX/WA (no tax). Add more by editing `src/tables/states-2025.json` and, if needed, `src/engine/tax/state.ts`.
- 10% early-withdrawal penalty before age 59.5.
- Federal estate tax (exemption is ~$14M per person in 2025, rare).
- State inheritance tax.
- Qualified Charitable Distributions (QCDs) from IRAs at 70.5+.
- Mega-backdoor-Roth from 401(k) after-tax contributions.
- Inherited IRA 10-year clock for the original owner's own beneficiaries (modeled as a one-shot heir tax rate on ending balance).
- ACA premium tax credits for early retirees below 65.
- Tax-law sunset scenarios beyond a simple flag. Engine uses 2025 current-law tables.

## Disclaimer

This is an educational modeling tool. It is not tax preparation software, not personalized financial advice, and the author is not a registered investment advisor. The tax engine applies 2025 U.S. federal rules and a simplified state model; state treatment in particular is approximated. For real decisions, work with a fee-only Certified Financial Planner or tax professional. Use the output and the AI-prompt export as a starting point for that conversation, not as a substitute.

## Contributing

Issues and pull requests welcome. Things that would be immediately useful:

- Additional state tax configurations (see `src/tables/states-2025.json` + `src/engine/tax/state.ts`).
- 2026 tax-table updates when the new brackets and IRMAA tiers are published.
- Monte Carlo simulation layer on top of the existing deterministic engine.
- Additional rules: QCDs, mega-backdoor Roth, ACA premium tax credit modeling.

License: TBD. The author is still deciding - MIT, Apache 2.0, or AGPL-3.0 are the candidates. Until a LICENSE file exists, the code is viewable but not licensed for redistribution.

## Support

If this saved you tax dollars, consider [buying me a coffee](https://www.buymeacoffee.com/retireright). Coffee money funds annual tax-table updates, more state-tax support, and Monte Carlo simulation work.

## Credits

Built with React, TypeScript, Vite, Zustand, Zod, Recharts, and decimal.js.
