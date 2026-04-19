import { Scenario, StrategyResult } from '../types';

export function buildAiPrompt(scenario: Scenario, strategies: StrategyResult[]): string {
  const h = scenario.household;
  const p = h.primary;
  const s = h.spouse;

  const lines: string[] = [];
  lines.push(`# Retirement Planning Consultation`);
  lines.push('');
  lines.push(`I'd like a second opinion on my retirement plan. Below is a summary of my household, assets, and the strategies my local planning tool identified. Please review and suggest any refinements, risks, or considerations I might be missing (QCDs, HSA strategy, inherited IRA rules, state-specific quirks, estate planning, ACA subsidy cliffs before Medicare, etc.).`);
  lines.push('');
  lines.push(`## Household`);
  lines.push(`- Filing status: ${h.filingStatus.toUpperCase()}`);
  lines.push(`- Primary: ${p.name}, born ${p.birthYear}, state ${p.state}, SS at FRA (67) = $${fmt(p.ssBenefitAt67)}, planned claim age ${p.ssClaimAge}`);
  if (s) {
    lines.push(`- Spouse: ${s.name}, born ${s.birthYear}, state ${s.state}, SS at FRA (67) = $${fmt(s.ssBenefitAt67)}, planned claim age ${s.ssClaimAge}`);
  }
  lines.push(`- Plan end age: ${h.planEndAge}`);
  lines.push('');

  lines.push(`## Accounts`);
  const grouped = groupBy(scenario.accounts, (a) => a.type);
  for (const [type, accs] of Object.entries(grouped)) {
    const total = accs.reduce((x, a) => x + a.balance, 0);
    lines.push(`- ${type}: $${fmt(total)} (${accs.length} account${accs.length > 1 ? 's' : ''})`);
  }
  lines.push('');

  lines.push(`## Income streams`);
  if (scenario.incomeStreams.length === 0) {
    lines.push(`- None`);
  } else {
    for (const is of scenario.incomeStreams) {
      lines.push(`- ${is.label}: $${fmt(is.annualAmount)}/yr (${is.kind}), ${is.startYear}${is.endYear ? `–${is.endYear}` : '+'}`);
    }
  }
  lines.push('');

  lines.push(`## Spending & assumptions`);
  lines.push(`- Base annual spending: $${fmt(scenario.spending.baseAnnual)} (today's dollars)`);
  lines.push(`- Pre-65 healthcare add-on: $${fmt(scenario.spending.healthcarePre65Annual)}/yr`);
  lines.push(`- Inflation: ${(scenario.assumptions.inflation * 100).toFixed(1)}%`);
  lines.push(`- Discount rate for scoring: ${(scenario.assumptions.discountRate * 100).toFixed(1)}%`);
  lines.push('');

  if (strategies.length > 0) {
    lines.push(`## Strategies evaluated`);
    for (const r of strategies) {
      lines.push('');
      lines.push(`### ${r.strategy.label}`);
      lines.push(`- Lifetime spending covered: $${fmt(r.lifetimeAfterTax)}`);
      lines.push(`- Lifetime tax paid: $${fmt(r.lifetimeTax)}`);
      lines.push(`- Ending net worth (age ${h.planEndAge}): $${fmt(r.endingNetWorth)}`);
      lines.push(`- Shortfall any year: ${r.anyShortfall ? 'YES' : 'no'}`);
      if (r.actions.length > 0) {
        lines.push(`- Actions:`);
        for (const a of r.actions) lines.push(`  - ${a.replace(/^\s+•\s*/, '')}`);
      }
      if (r.rationale) lines.push(`- Rationale: ${r.rationale}`);
      if (r.pros.length) lines.push(`- Pros: ${r.pros.join(' ')}`);
      if (r.cons.length) lines.push(`- Cons: ${r.cons.join(' ')}`);
    }
    lines.push('');
  }

  lines.push(`## Questions for you`);
  lines.push(`1. Do any of the assumptions above look wrong or inconsistent?`);
  lines.push(`2. Are there strategies I'm not considering that could improve my lifetime outcome?`);
  lines.push(`3. What risks should I monitor (sequence-of-returns, tax law changes, long-term care, etc.)?`);
  lines.push(`4. Are there any state-specific or filing-status-specific details I should act on?`);
  return lines.join('\n');
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function groupBy<T, K extends string>(arr: T[], keyFn: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const t of arr) {
    const k = keyFn(t);
    if (!out[k]) out[k] = [];
    out[k].push(t);
  }
  return out;
}
