import { Account, AccountType, WithdrawalPolicy } from '../types';

export type AccountState = {
  id: string;
  ownerId: string;
  type: AccountType;
  label: string;
  balance: number;
  /**
   * After-tax basis.
   * - taxable: cost basis (balance - basis = unrealized LTCG)
   * - traditional-ira / traditional-401k: non-deductible contributions per IRC §72 /
   *   Form 8606 (after-tax basis). Defaults to 0 (fully pre-tax).
   * - roth-*: not used in math (withdrawals fully tax-free post-59.5); kept as balance.
   * - hsa: treated like traditional (non-qualified withdrawal = ordinary income); defaults to 0.
   */
  costBasis: number;
  expectedReturn: number;
};

export function initAccountState(acc: Account): AccountState {
  let costBasis = acc.costBasis;
  if (costBasis == null) {
    if (acc.type === 'taxable') {
      costBasis = acc.balance; // assume no unrealized gain unless specified
    } else if (isRoth(acc.type)) {
      costBasis = acc.balance; // Roth: all tax-free
    } else {
      costBasis = 0; // traditional/HSA: all pre-tax unless user specifies non-deductible basis
    }
  }
  return {
    id: acc.id,
    ownerId: acc.ownerId,
    type: acc.type,
    label: acc.label,
    balance: acc.balance,
    costBasis,
    expectedReturn: acc.expectedReturn,
  };
}

export function isTraditional(type: AccountType): boolean {
  return type === 'traditional-ira' || type === 'traditional-401k';
}

export function isRoth(type: AccountType): boolean {
  return type === 'roth-ira' || type === 'roth-401k';
}

/**
 * Grow an account by its expected return. Basis does NOT grow with market returns —
 * that's the whole point of tracking it. For Roth we keep basis == balance purely
 * as a bookkeeping invariant (withdrawals don't touch basis for Roth).
 */
export function applyGrowth(acc: AccountState): void {
  const delta = acc.balance * acc.expectedReturn;
  acc.balance += delta;
  if (isRoth(acc.type)) {
    acc.costBasis = acc.balance;
  }
  // taxable + traditional + hsa: costBasis unchanged (growth is untaxed gain)
}

export type WithdrawalResult = {
  withdrawn: number;
  ordinaryTaxable: number;
  ltcgTaxable: number;
  perAccount: Array<{ id: string; amount: number; ordinaryTaxable: number; ltcgTaxable: number }>;
};

/**
 * Pro-rata split: when you pull `take` from an account with some basis, the tax-free
 * fraction is basis/balance. IRC §72 applies this per-contract (each IRA, each 401k plan);
 * for simplicity we apply it per-account, which matches reality when a user has one
 * account per type (the common case).
 */
function proRataBasis(acc: AccountState, take: number): { basisPortion: number; taxablePortion: number } {
  if (acc.balance <= 0 || acc.costBasis <= 0) {
    return { basisPortion: 0, taxablePortion: take };
  }
  const fraction = Math.min(1, acc.costBasis / acc.balance);
  const basisPortion = take * fraction;
  return { basisPortion, taxablePortion: take - basisPortion };
}

/**
 * Withdraw `target` in account dollars (not net-of-tax cash) from accounts in order.
 * Returns the realized tax breakdown — ordinary income from traditional/HSA, LTCG from taxable.
 */
export function withdrawFromAccounts(
  _accounts: AccountState[],
  order: AccountState[],
  target: number,
): WithdrawalResult {
  const result: WithdrawalResult = {
    withdrawn: 0,
    ordinaryTaxable: 0,
    ltcgTaxable: 0,
    perAccount: [],
  };
  let remaining = target;
  for (const acc of order) {
    if (remaining <= 0) break;
    if (acc.balance <= 0) continue;
    const take = Math.min(acc.balance, remaining);
    const { basisPortion, taxablePortion } = proRataBasis(acc, take);

    let ord = 0;
    let ltcg = 0;
    if (isTraditional(acc.type) || acc.type === 'hsa') {
      ord = taxablePortion;
    } else if (acc.type === 'taxable') {
      ltcg = taxablePortion;
    }
    // Roth: neither portion is taxable

    acc.costBasis = Math.max(0, acc.costBasis - basisPortion);
    acc.balance -= take;

    result.withdrawn += take;
    result.ordinaryTaxable += ord;
    result.ltcgTaxable += ltcg;
    result.perAccount.push({ id: acc.id, amount: take, ordinaryTaxable: ord, ltcgTaxable: ltcg });
    remaining -= take;
  }
  return result;
}

export function buildWithdrawalOrder(
  accounts: AccountState[],
  policy: WithdrawalPolicy,
): AccountState[] {
  const taxable = accounts.filter((a) => a.type === 'taxable');
  const traditional = accounts.filter((a) => isTraditional(a.type));
  const roth = accounts.filter((a) => isRoth(a.type));
  const hsa = accounts.filter((a) => a.type === 'hsa');
  if (policy === 'conventional' || policy === 'bracket-fill') {
    return [...taxable, ...traditional, ...hsa, ...roth];
  }
  return [...taxable, ...traditional, ...hsa, ...roth];
}

export type ConversionResult = {
  converted: number;       // gross amount moved from traditional → Roth
  taxable: number;         // portion subject to ordinary income tax this year (pre-tax portion)
  basisTransferred: number; // portion that was already after-tax (not taxable again)
};

/**
 * Convert traditional → Roth with the pro-rata rule. Only the pre-tax fraction is taxable;
 * the after-tax basis portion transfers into the Roth tax-free.
 */
export function convertTraditionalToRoth(
  accounts: AccountState[],
  ownerId: string,
  amount: number,
): ConversionResult {
  let remaining = amount;
  const sources = accounts.filter((a) => isTraditional(a.type) && a.ownerId === ownerId);
  const targets = accounts.filter((a) => isRoth(a.type) && a.ownerId === ownerId);
  if (sources.length === 0 || targets.length === 0 || amount <= 0) {
    return { converted: 0, taxable: 0, basisTransferred: 0 };
  }
  let converted = 0;
  let taxable = 0;
  let basisTransferred = 0;
  for (const src of sources) {
    if (remaining <= 0) break;
    if (src.balance <= 0) continue;
    const take = Math.min(src.balance, remaining);
    const { basisPortion, taxablePortion } = proRataBasis(src, take);
    src.balance -= take;
    src.costBasis = Math.max(0, src.costBasis - basisPortion);
    converted += take;
    taxable += taxablePortion;
    basisTransferred += basisPortion;
    remaining -= take;
  }
  if (converted > 0) {
    const target = targets[0];
    target.balance += converted;
    target.costBasis += converted; // full amount becomes Roth basis (now tax-free forever)
  }
  return { converted, taxable, basisTransferred };
}
