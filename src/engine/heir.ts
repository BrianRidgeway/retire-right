import { Account, AccountBalance, Assumptions } from '../types';
import { AccountState, isRoth, isTraditional } from './accounts';

/**
 * Compute after-heir-tax value of the accounts as of end of year.
 *
 * Rules under current US tax law (non-spouse beneficiary, SECURE Act 10-year rule):
 *  - Traditional IRA / 401(k) / HSA (non-spouse): taxable portion (balance − basis) hits the
 *    heir as ordinary income over 10 years, taxed at their marginal rate. Basis (non-deductible
 *    contributions tracked on Form 8606) passes tax-free. For HSA specifically, non-spouse
 *    inheritance loses HSA status and the whole balance (less basis) becomes ordinary income
 *    in year of death - we use the same approximation.
 *  - Roth IRA / 401(k): passes tax-free (assumes 5-year rule met).
 *  - Taxable brokerage: step-up in basis at death wipes unrealized gains; heir can sell at
 *    FMV with no tax. Full balance passes.
 *
 * Federal estate tax is not modeled (exemption is ~$14M per person in 2025, rare).
 * State inheritance tax is not modeled.
 */
export function heirNetValue(accounts: AccountState[], heirMarginalTaxRate: number): number {
  let total = 0;
  for (const acc of accounts) {
    total += heirNetForAccount(acc, heirMarginalTaxRate);
  }
  return total;
}

export function heirNetForAccount(acc: AccountState, heirMarginalTaxRate: number): number {
  if (acc.balance <= 0) return 0;
  if (isTraditional(acc.type) || acc.type === 'hsa') {
    const basis = Math.min(acc.costBasis, acc.balance);
    const taxable = Math.max(0, acc.balance - basis);
    return basis + taxable * (1 - heirMarginalTaxRate);
  }
  if (isRoth(acc.type) || acc.type === 'taxable') {
    // Roth: tax-free on distribution. Taxable: step-up in basis eliminates LTCG.
    return acc.balance;
  }
  return acc.balance;
}

/**
 * Compute the share-weighted effective heir marginal rate. When `assumptions.heirs` is empty,
 * falls back to `assumptions.heirMarginalTaxRate`. When non-empty, returns the weighted average
 * of each heir's marginal rate by their share.
 */
export function effectiveHeirRate(assumptions: Assumptions): number {
  if (assumptions.heirs.length === 0) return assumptions.heirMarginalTaxRate;
  const totalShare = assumptions.heirs.reduce((s, h) => s + h.sharePct, 0);
  if (totalShare <= 0) return assumptions.heirMarginalTaxRate;
  return assumptions.heirs.reduce((s, h) => s + h.marginalRatePct * (h.sharePct / totalShare), 0);
}

/**
 * Compute after-heir-tax value from a year's `balancesEoy` snapshot plus the account-type lookup
 * from the scenario. Used for sensitivity analysis where we want to re-evaluate the same final
 * snapshot at different heir tax rates without rerunning the projection.
 */
export function heirNetFromBalances(
  balances: AccountBalance[],
  accounts: Account[],
  heirRate: number,
): number {
  const typeById = new Map(accounts.map((a) => [a.id, a.type] as const));
  let total = 0;
  for (const b of balances) {
    if (b.balance <= 0) continue;
    const type = typeById.get(b.accountId);
    if (!type) continue;
    if (type === 'traditional-ira' || type === 'traditional-401k' || type === 'hsa') {
      // We don't carry basis through balancesEoy for traditional/HSA — they're approximated
      // as fully pre-tax for sensitivity. (The main heirNetValue uses the live account state
      // which does carry basis.)
      total += b.balance * (1 - heirRate);
    } else {
      // Roth + taxable pass at face (step-up / tax-free).
      total += b.balance;
    }
  }
  return total;
}
