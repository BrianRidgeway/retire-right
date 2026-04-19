import { Scenario, Strategy, StrategyResult } from '../../types';
import { ssClaimAgeMultiplier } from '../tax/ss';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Generate a bulleted list of concrete actions that distinguish this strategy
 * from the scenario's "current plan" baseline.
 */
export function describeActions(scenario: Scenario, strategy: Strategy): string[] {
  const actions: string[] = [];

  const conv = Object.entries(strategy.rothConversions)
    .map(([y, amt]) => ({ year: Number(y), amount: amt }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => a.year - b.year);

  if (conv.length > 0) {
    const total = conv.reduce((s, c) => s + c.amount, 0);
    const first = conv[0].year;
    const last = conv[conv.length - 1].year;
    const span = first === last ? `${first}` : `${first}–${last}`;
    actions.push(
      `Convert a total of ${fmt(total)} from traditional IRA → Roth over ${conv.length} year${conv.length === 1 ? '' : 's'} (${span}).`,
    );
    // Show up to the first 4 years individually
    for (const c of conv.slice(0, 4)) {
      actions.push(`  • ${c.year}: convert ${fmt(c.amount)}`);
    }
    if (conv.length > 4) {
      actions.push(`  • …and ${conv.length - 4} more year${conv.length - 4 === 1 ? '' : 's'}.`);
    }
  }

  const primary = scenario.household.primary;
  const spouse = scenario.household.spouse;
  const primaryClaim = strategy.ssClaimAges[primary.id];
  const spouseClaim = spouse ? strategy.ssClaimAges[spouse.id] : undefined;

  if (primaryClaim != null && primaryClaim !== primary.ssClaimAge) {
    const pct = (ssClaimAgeMultiplier(primaryClaim) - 1) * 100;
    const direction = primaryClaim > primary.ssClaimAge ? 'delay' : 'accelerate';
    actions.push(
      `${capitalize(direction)} ${primary.name}'s Social Security claim from age ${primary.ssClaimAge} → ${primaryClaim} (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs FRA benefit).`,
    );
  }
  if (spouse && spouseClaim != null && spouseClaim !== spouse.ssClaimAge) {
    const pct = (ssClaimAgeMultiplier(spouseClaim) - 1) * 100;
    const direction = spouseClaim > spouse.ssClaimAge ? 'delay' : 'accelerate';
    actions.push(
      `${capitalize(direction)} ${spouse.name}'s Social Security claim from age ${spouse.ssClaimAge} → ${spouseClaim} (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs FRA benefit).`,
    );
  }

  if (strategy.withdrawalPolicy !== 'conventional') {
    actions.push(`Use the ${describePolicy(strategy.withdrawalPolicy)} withdrawal policy instead of the default (taxable → traditional → Roth).`);
  }

  if (actions.length === 0) {
    actions.push('No changes vs your current plan — do nothing.');
  }

  return actions;
}

function describePolicy(p: Strategy['withdrawalPolicy']): string {
  switch (p) {
    case 'proportional':
      return 'proportional (draw from every account type each year, smoothing taxable income)';
    case 'bracket-fill':
      return 'bracket-fill (pull extra from traditional to fill the current ordinary bracket, then from taxable/Roth)';
    case 'conventional':
      return 'conventional';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Human-readable rationale per named strategy variant, plus a numeric
 * takeaway derived from the actual result vs baseline.
 */
export function describeRationale(r: StrategyResult, baseline: StrategyResult): string {
  const label = r.strategy.label;
  const dTax = baseline.lifetimeTax - r.lifetimeTax; // positive = saves tax
  const dEnd = r.endingNetWorth - baseline.endingNetWorth;
  const tail = ` In this scenario it saves ${fmt(Math.max(0, dTax))} in lifetime tax and ends with ${dEnd >= 0 ? fmt(dEnd) + ' more' : fmt(-dEnd) + ' less'} net worth vs do-nothing.`;

  if (label.toLowerCase().includes('roth ladder')) {
    return (
      `Converts traditional IRA dollars to Roth during low-income years before RMDs begin. ` +
      `You pay ordinary income tax now — when your bracket is likely lower — in exchange for smaller mandatory RMDs later, ` +
      `a lower MAGI in Medicare years (avoiding IRMAA surcharges), and tax-free growth on the converted dollars forever.` +
      tail
    );
  }
  if (label.toLowerCase().includes('delay ss')) {
    return (
      `Each year you delay Social Security past Full Retirement Age (67) earns a guaranteed +8% on your benefit, ` +
      `which is then indexed to inflation for life. Break-even vs claiming at 67 is roughly age 82; if either spouse ` +
      `lives past that, lifetime benefits are higher — and the higher benefit becomes the survivor benefit for whoever outlives the other.` +
      tail
    );
  }
  if (label.toLowerCase().includes('fully optimized')) {
    return (
      `The optimizer searched combinations of Social Security claim ages (62–70 per spouse), three withdrawal-order policies, ` +
      `and per-year Roth conversion amounts anchored at bracket and IRMAA tier ceilings. This combination maximized the ` +
      `present value of lifetime covered spending plus ending net worth, discounted at your chosen rate.` +
      tail
    );
  }
  if (label.toLowerCase().includes('do nothing')) {
    return `Keeps your current inputs exactly as entered — no Roth conversions, SS claim ages unchanged, withdrawal order is the default (taxable → traditional → Roth).`;
  }
  return `Custom strategy.` + tail;
}
