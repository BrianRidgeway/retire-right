import { Scenario, StrategyResult, YearResult } from '../../types';
import { IRMAA } from '../tables';
import { rmdApplicableAge } from '../rmd';
import { isTraditional } from '../accounts';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Concerns that apply to the input scenario itself — these are surfaced on every strategy
 * because the underlying problem isn't strategy-dependent (e.g. a person's SS claim age is in
 * the past, or the pension survivor election is unspecified).
 */
export function scenarioConcerns(scenario: Scenario): string[] {
  const out: string[] = [];
  const startYear = scenario.startYear;

  for (const person of [scenario.household.primary, scenario.household.spouse].filter(Boolean) as NonNullable<typeof scenario.household.spouse>[]) {
    const currentAge = startYear - person.birthYear;
    if (!person.ssAlreadyClaimed && currentAge > person.ssClaimAge) {
      out.push(
        `${person.name}'s planned Social Security claim age (${person.ssClaimAge}) is already in the past — they are ${currentAge} now. Either mark "already claimed" with their actual benefit, or correct the claim age.`,
      );
    }
    if (!person.ssAlreadyClaimed && currentAge === person.ssClaimAge) {
      out.push(
        `${person.name} reaches their planned claim age (${person.ssClaimAge}) this year. If they have already filed, mark "already claimed" with the actual benefit amount instead of relying on the projected FRA × multiplier.`,
      );
    }
  }

  const pensions = scenario.incomeStreams.filter((i) => i.kind === 'pension');
  for (const p of pensions) {
    const sp = (p as unknown as { survivorPct?: number }).survivorPct;
    if (sp == null) {
      out.push(
        `Pension "${p.label}" has no survivor election specified. The survivor scenario assumes 100% continuation by default; if your real election is 50% or 75%, set it on the income stream so the widow's-penalty scenario is accurate.`,
      );
    }
  }

  // Asset-location check: bonds/REITs in taxable + equities in traditional → flag rebalance
  const taxableAccs = scenario.accounts.filter((a) => a.type === 'taxable');
  const traditionalAccs = scenario.accounts.filter((a) => a.type === 'traditional-ira' || a.type === 'traditional-401k');
  let bondsInTaxable = 0;
  let equitiesInTraditional = 0;
  for (const a of taxableAccs) {
    const mix = a.assetMix ?? { equitiesPct: 1, bondsPct: 0, reitsPct: 0 };
    bondsInTaxable += a.balance * (mix.bondsPct + mix.reitsPct);
  }
  for (const a of traditionalAccs) {
    const mix = a.assetMix ?? { equitiesPct: 1, bondsPct: 0, reitsPct: 0 };
    equitiesInTraditional += a.balance * mix.equitiesPct;
  }
  const swap = Math.min(bondsInTaxable, equitiesInTraditional);
  if (swap > 25_000) {
    out.push(
      `Asset location: ~${fmt(bondsInTaxable)} of bonds/REITs are in taxable accounts (annual ordinary-income tax drag) and ~${fmt(equitiesInTraditional)} of equities are in traditional accounts (would otherwise grow tax-deferred). Swap up to ${fmt(swap)} — put bonds/REITs in traditional, equities in taxable + Roth — to reduce the ongoing tax drag.`,
    );
  }

  return out;
}

/**
 * Concerns specific to a particular strategy's output — IRMAA cliffs, step-up forfeiture,
 * unused conversion headroom past RMD age, etc.
 */
export function strategyConcerns(
  scenario: Scenario,
  results: YearResult[],
  strategy: StrategyResult['strategy'],
): string[] {
  const out: string[] = [];
  const status = scenario.household.filingStatus;
  const irmaaTops = IRMAA.tiers[status].map((t) => t.magiMax).filter((v): v is number => v != null);
  const topIrmaaCeiling = irmaaTops[irmaaTops.length - 1];

  // 1. Conversions that overshoot the top IRMAA tier
  for (const [yearStr, amount] of Object.entries(strategy.rothConversions)) {
    if (amount <= 0) continue;
    const year = Number(yearStr);
    const row = results.find((r) => r.year === year);
    if (!row) continue;
    if (topIrmaaCeiling != null && row.magiIrmaa > topIrmaaCeiling) {
      const overshoot = row.magiIrmaa - topIrmaaCeiling;
      out.push(
        `Year ${year}: conversion of ${fmt(amount)} pushes MAGI to ${fmt(row.magiIrmaa)}, which is ${fmt(overshoot)} into the top IRMAA tier. That's $${(Math.round((overshoot / amount) * 100))}% of the converted amount paying the top-tier surcharge — consider spreading across more years.`,
      );
    }
  }

  // 2. Single-year conversion bangs (one year >= 4x the mean of all years)
  const convYears = Object.entries(strategy.rothConversions)
    .map(([y, a]) => ({ year: Number(y), amount: a }))
    .filter((c) => c.amount > 0);
  if (convYears.length >= 2) {
    const mean = convYears.reduce((s, c) => s + c.amount, 0) / convYears.length;
    const biggest = convYears.reduce((a, b) => (a.amount > b.amount ? a : b));
    if (biggest.amount > 4 * mean) {
      out.push(
        `Conversion plan is heavily concentrated in ${biggest.year} (${fmt(biggest.amount)}, vs ${fmt(mean)} average). Single-year bangs are usually dominated by multi-year spreading; verify the optimizer considered the spread alternative.`,
      );
    }
  }

  // 3. Withdrawal order leaves unrealized gains in taxable that get drained instead of stepping up
  const last = results[results.length - 1];
  if (last && strategy.withdrawalPolicy === 'conventional') {
    const taxableAcc = scenario.accounts.find((a) => a.type === 'taxable');
    if (taxableAcc && taxableAcc.costBasis != null && taxableAcc.balance > taxableAcc.costBasis) {
      const unrealizedAtStart = taxableAcc.balance - taxableAcc.costBasis;
      const taxableEoy = last.balancesEoy.find((b) => b.accountId === taxableAcc.id);
      const drained = taxableAcc.balance - (taxableEoy?.balance ?? 0);
      if (drained > 0 && unrealizedAtStart > 50_000) {
        out.push(
          `The default withdrawal order (taxable → traditional → Roth) drains the brokerage account before the traditional IRA. ${fmt(unrealizedAtStart)} of unrealized gains at start would have stepped up to heirs at death; the "preserve-for-step-up" policy may leave more after-heir-tax wealth.`,
        );
      }
    }
  }

  // 4. RMD-age spouse with no conversions despite low-bracket headroom
  for (const person of [scenario.household.primary, scenario.household.spouse].filter(Boolean) as NonNullable<typeof scenario.household.spouse>[]) {
    const currentAge = scenario.startYear - person.birthYear;
    const rmdAge = rmdApplicableAge(person.birthYear);
    if (currentAge < rmdAge) continue;
    const hasTrad = scenario.accounts.some((a) => a.ownerId === person.id && isTraditional(a.type));
    if (!hasTrad) continue;
    const totalConv = Object.values(strategy.rothConversions).reduce((s, a) => s + a, 0);
    if (totalConv === 0) {
      out.push(
        `${person.name} is past RMD age (${rmdAge}) and has traditional balance, but this strategy proposes zero Roth conversions. Stacking conversions on top of RMDs is still beneficial if the marginal cost (federal + state + IRMAA + NIIT) is below the rate heirs would pay under the SECURE 10-year rule.`,
      );
    }
  }

  return out;
}
