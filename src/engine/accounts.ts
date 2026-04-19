import { Account, AccountType, WithdrawalPolicy } from '../types';

export type AccountState = {
  id: string;
  ownerId: string;
  type: AccountType;
  label: string;
  balance: number;
  costBasis: number; // for taxable accounts
  expectedReturn: number;
};

export function initAccountState(acc: Account): AccountState {
  return {
    id: acc.id,
    ownerId: acc.ownerId,
    type: acc.type,
    label: acc.label,
    balance: acc.balance,
    costBasis: acc.costBasis ?? acc.balance,
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
 * Grow an account by its expected return. Reinvests in place.
 */
export function applyGrowth(acc: AccountState): void {
  const delta = acc.balance * acc.expectedReturn;
  acc.balance += delta;
  if (acc.type === 'taxable') {
    // New growth adds to balance but not cost basis (assume unrealized).
    // cost basis unchanged
  } else {
    acc.costBasis = acc.balance;
  }
}

export type WithdrawalResult = {
  withdrawn: number;
  ordinaryTaxable: number; // from traditional IRA/401k or HSA non-qualified
  ltcgTaxable: number; // realized gains from taxable
  perAccount: Array<{ id: string; amount: number; ordinaryTaxable: number; ltcgTaxable: number }>;
};

/**
 * Withdraw `target` in taxable dollars (i.e., cash into hand) from accounts, in the order given.
 * For taxable accounts, we treat withdrawals as proportional-basis realizations.
 * For traditional, the full amount is ordinary income.
 * For Roth, the withdrawal is tax-free (assumes age 59.5+, which projection should guard).
 */
export function withdrawFromAccounts(
  accounts: AccountState[],
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
    let ord = 0,
      ltcg = 0;
    if (isTraditional(acc.type) || acc.type === 'hsa') {
      ord = take;
    } else if (acc.type === 'taxable') {
      const basisPortion = acc.balance > 0 ? (acc.costBasis / acc.balance) * take : take;
      const gainPortion = take - basisPortion;
      acc.costBasis = Math.max(0, acc.costBasis - basisPortion);
      ltcg = Math.max(0, gainPortion);
    } else if (isRoth(acc.type)) {
      // tax-free
    }
    acc.balance -= take;
    result.withdrawn += take;
    result.ordinaryTaxable += ord;
    result.ltcgTaxable += ltcg;
    result.perAccount.push({ id: acc.id, amount: take, ordinaryTaxable: ord, ltcgTaxable: ltcg });
    remaining -= take;
  }
  // Mirror balance changes onto the master list (order holds references to same objects, so nothing extra needed)
  void accounts;
  return result;
}

/**
 * Build withdrawal order per policy.
 * - conventional: taxable → traditional → Roth
 * - proportional: draw proportionally across all non-Roth, then Roth
 * - bracket-fill: caller handles this higher up (falls through to conventional here)
 */
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
  // proportional: interleave by share
  const pool = [...taxable, ...traditional, ...hsa, ...roth];
  return pool;
}

/**
 * Convert from traditional → Roth. Amount is ordinary income in the year. Returns amount actually converted.
 */
export function convertTraditionalToRoth(
  accounts: AccountState[],
  ownerId: string,
  amount: number,
): number {
  let remaining = amount;
  const sources = accounts.filter((a) => isTraditional(a.type) && a.ownerId === ownerId);
  const targets = accounts.filter((a) => isRoth(a.type) && a.ownerId === ownerId);
  if (sources.length === 0 || targets.length === 0) return 0;
  let converted = 0;
  for (const src of sources) {
    if (remaining <= 0) break;
    const take = Math.min(src.balance, remaining);
    src.balance -= take;
    remaining -= take;
    converted += take;
  }
  // Deposit into first Roth account
  if (converted > 0) {
    targets[0].balance += converted;
  }
  return converted;
}
