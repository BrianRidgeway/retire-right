import { AccountState, isRoth, isTraditional } from './accounts';

/**
 * Compute after-heir-tax value of the accounts as of end of year.
 *
 * Rules under current US tax law (non-spouse beneficiary, SECURE Act 10-year rule):
 *  - Traditional IRA / 401(k) / HSA (non-spouse): taxable portion (balance − basis) hits the
 *    heir as ordinary income over 10 years, taxed at their marginal rate. Basis (non-deductible
 *    contributions tracked on Form 8606) passes tax-free. For HSA specifically, non-spouse
 *    inheritance loses HSA status and the whole balance (less basis) becomes ordinary income
 *    in year of death — we use the same approximation.
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
