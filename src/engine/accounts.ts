import { Account, AccountType, AssetMix, WithdrawalPolicy } from '../types';
import { Bracket, StatusKey } from './tables';

const DEFAULT_MIX: AssetMix = { equitiesPct: 1, bondsPct: 0, reitsPct: 0 };

/**
 * Yield fraction by asset class — what portion of the asset's total return arrives as
 * a taxable annual distribution (rather than deferred price appreciation).
 *   - equity dividends ≈ 30% of total return (qualified dividend taxation)
 *   - bond interest ≈ 100% of total return (ordinary income)
 *   - REIT distributions ≈ 80% of total return (mostly ordinary, some return-of-capital)
 */
const YIELD_FRAC = { equity: 0.3, bonds: 1.0, reits: 0.8 };
const REIT_ORDINARY_FRAC = 0.7; // 70% of REIT distribution is ordinary, 30% qualified/return-of-capital

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
  assetMix: AssetMix;
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
    assetMix: acc.assetMix ?? DEFAULT_MIX,
  };
}

/**
 * Compute annual taxable yield (cash distributions hitting AGI this year) for a taxable
 * account based on its asset mix. Returns {ordinary, qualifiedDividends}.
 *
 * The yield is assumed to be a fraction of total return per asset class (see YIELD_FRAC).
 * Price appreciation (the rest of expectedReturn) stays deferred until sale. Non-taxable
 * accounts (traditional, Roth, HSA) have no annual tax drag — they're shielded.
 */
export function annualTaxableYield(acc: AccountState): { ordinary: number; qualifiedDividends: number } {
  if (acc.type !== 'taxable' || acc.balance <= 0 || acc.expectedReturn <= 0) {
    return { ordinary: 0, qualifiedDividends: 0 };
  }
  const m = acc.assetMix;
  const grossReturn = acc.balance * acc.expectedReturn;
  const equityYield = grossReturn * m.equitiesPct * YIELD_FRAC.equity; // qualified divs
  const bondYield = grossReturn * m.bondsPct * YIELD_FRAC.bonds; // ordinary interest
  const reitYield = grossReturn * m.reitsPct * YIELD_FRAC.reits;
  return {
    ordinary: bondYield + reitYield * REIT_ORDINARY_FRAC,
    qualifiedDividends: equityYield + reitYield * (1 - REIT_ORDINARY_FRAC),
  };
}

export function isTraditional(type: AccountType): boolean {
  return type === 'traditional-ira' || type === 'traditional-401k';
}

export function isRoth(type: AccountType): boolean {
  return type === 'roth-ira' || type === 'roth-401k';
}

/**
 * Grow an account by its expected return. For taxable accounts the yield portion of return
 * (dividends + interest + REIT distributions) is reinvested with tax already paid, so basis
 * bumps by that amount. Price appreciation stays as unrealized LTCG. For Roth, basis tracks
 * balance (withdrawals are tax-free regardless of basis).
 */
export function applyGrowth(acc: AccountState): void {
  const delta = acc.balance * acc.expectedReturn;
  acc.balance += delta;
  if (isRoth(acc.type)) {
    acc.costBasis = acc.balance;
  } else if (acc.type === 'taxable') {
    // Yield was already taxed this year via the projection's AGI; reinvested → basis up by yield.
    const y = annualTaxableYield({ ...acc, balance: acc.balance - delta });
    acc.costBasis += y.ordinary + y.qualifiedDividends;
    if (acc.costBasis > acc.balance) acc.costBasis = acc.balance;
  }
  // traditional + hsa: costBasis unchanged (growth is fully untaxed pre-tax gain)
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
 * Returns the realized tax breakdown - ordinary income from traditional/HSA, LTCG from taxable.
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

/**
 * Default account ordering for a named policy. The 'proportional' and 'bracket-fill' policies
 * use a different withdrawal mechanism (see executeWithdrawal) and ignore this ordering.
 */
export function buildWithdrawalOrder(
  accounts: AccountState[],
  policy: WithdrawalPolicy,
): AccountState[] {
  const taxable = accounts.filter((a) => a.type === 'taxable');
  const traditional = accounts.filter((a) => isTraditional(a.type));
  const roth = accounts.filter((a) => isRoth(a.type));
  const hsa = accounts.filter((a) => a.type === 'hsa');
  switch (policy) {
    case 'conventional':
      return [...taxable, ...traditional, ...hsa, ...roth];
    case 'preserve-for-step-up':
      // Drain traditional first (no step-up; SECURE 10-year tax bomb for heirs),
      // then Roth (tax-free but heirs also get it tax-free), preserve taxable
      // to the end so unrealized gains step up at death.
      return [...traditional, ...hsa, ...roth, ...taxable];
    case 'proportional':
    case 'bracket-fill':
      // These policies use executeWithdrawal; fall back to conventional ordering if
      // executeWithdrawal isn't used.
      return [...taxable, ...traditional, ...hsa, ...roth];
  }
}

export type PolicyContext = {
  status: StatusKey;
  /** Taxable ordinary income BEFORE any extra (non-RMD) withdrawals this year. */
  ordinaryIncomeBeforeExtra: number;
  /** Standard deduction applicable this year (used to convert to taxable ordinary). */
  standardDeduction: number;
  federalBrackets: Bracket[];
};

/**
 * Top-level withdrawal dispatcher. All four policies funnel through here.
 * - conventional / preserve-for-step-up: simple ordered drain
 * - proportional: split target across non-Roth accounts proportionally to balance
 * - bracket-fill: pull from traditional up to current marginal bracket headroom, then taxable
 */
export function executeWithdrawal(
  accounts: AccountState[],
  policy: WithdrawalPolicy,
  target: number,
  context: PolicyContext,
): WithdrawalResult {
  if (target <= 0) {
    return { withdrawn: 0, ordinaryTaxable: 0, ltcgTaxable: 0, perAccount: [] };
  }
  if (policy === 'proportional') {
    return withdrawProportional(accounts, target);
  }
  if (policy === 'bracket-fill') {
    return withdrawBracketFill(accounts, target, context);
  }
  // conventional or preserve-for-step-up
  return withdrawFromAccounts(accounts, buildWithdrawalOrder(accounts, policy), target);
}

/**
 * Pull `target` proportionally to current balance across non-Roth accounts (taxable + traditional + hsa).
 * Roth is preserved unless the non-Roth pool can't cover the target.
 */
function withdrawProportional(accounts: AccountState[], target: number): WithdrawalResult {
  const nonRoth = accounts.filter((a) => !isRoth(a.type) && a.balance > 0);
  const totalNonRoth = nonRoth.reduce((s, a) => s + a.balance, 0);
  const result: WithdrawalResult = { withdrawn: 0, ordinaryTaxable: 0, ltcgTaxable: 0, perAccount: [] };

  if (totalNonRoth <= 0) {
    // No non-Roth balance; fall back to Roth
    const roth = accounts.filter((a) => isRoth(a.type));
    return withdrawFromAccounts(accounts, roth, target);
  }

  const cap = Math.min(target, totalNonRoth);
  for (const acc of nonRoth) {
    if (cap <= 0) break;
    const share = (acc.balance / totalNonRoth) * cap;
    const take = Math.min(acc.balance, share);
    const { basisPortion, taxablePortion } = proRataBasis(acc, take);
    let ord = 0;
    let ltcg = 0;
    if (isTraditional(acc.type) || acc.type === 'hsa') ord = taxablePortion;
    else if (acc.type === 'taxable') ltcg = taxablePortion;
    acc.costBasis = Math.max(0, acc.costBasis - basisPortion);
    acc.balance -= take;
    result.withdrawn += take;
    result.ordinaryTaxable += ord;
    result.ltcgTaxable += ltcg;
    result.perAccount.push({ id: acc.id, amount: take, ordinaryTaxable: ord, ltcgTaxable: ltcg });
  }

  // If still short (because some account hit zero before its share), continue from any remaining
  // non-Roth balance, then Roth.
  if (result.withdrawn < target) {
    const remaining = target - result.withdrawn;
    const fallback = [
      ...accounts.filter((a) => !isRoth(a.type) && a.balance > 0),
      ...accounts.filter((a) => isRoth(a.type)),
    ];
    const extra = withdrawFromAccounts(accounts, fallback, remaining);
    result.withdrawn += extra.withdrawn;
    result.ordinaryTaxable += extra.ordinaryTaxable;
    result.ltcgTaxable += extra.ltcgTaxable;
    result.perAccount.push(...extra.perAccount);
  }
  return result;
}

/**
 * Bracket-fill: first pull from traditional/HSA up to the headroom in the current marginal ordinary
 * bracket (income-dollar terms), then satisfy the remaining target from taxable, then remaining
 * traditional/HSA, then Roth as a last resort.
 *
 * The "headroom" is computed against current marginal bracket, not the standard deduction or any
 * higher bracket — the optimizer's Roth ladder handles bracket-top conversions separately. This
 * policy's job is just to avoid jumping brackets via excess traditional withdrawals.
 */
function withdrawBracketFill(
  accounts: AccountState[],
  target: number,
  ctx: PolicyContext,
): WithdrawalResult {
  const result: WithdrawalResult = { withdrawn: 0, ordinaryTaxable: 0, ltcgTaxable: 0, perAccount: [] };
  const taxableOrdinary = Math.max(0, ctx.ordinaryIncomeBeforeExtra - ctx.standardDeduction);
  const currentBracket = ctx.federalBrackets.find(
    (b) => taxableOrdinary >= b.min && (b.max == null || taxableOrdinary < b.max),
  );
  const bracketTop = currentBracket?.max ?? Infinity;
  const headroom = Math.max(0, bracketTop - taxableOrdinary);

  // Step 1: traditional/HSA up to headroom (treating taxablePortion as the headroom-consuming amount).
  // Since proRataBasis is per-account, we approximate by tracking running taxablePortion drained.
  let runningTaxablePulled = 0;
  const traditional = accounts.filter((a) => (isTraditional(a.type) || a.type === 'hsa') && a.balance > 0);
  for (const acc of traditional) {
    if (result.withdrawn >= target) break;
    if (runningTaxablePulled >= headroom) break;
    const room = headroom - runningTaxablePulled;
    // Pulling `take` from acc creates taxablePortion = take * (1 - basisFrac).
    // Solve for max take such that taxablePortion <= room and total <= remaining target.
    const basisFrac = acc.balance > 0 ? Math.min(1, acc.costBasis / acc.balance) : 0;
    const taxableFrac = 1 - basisFrac;
    const maxTakeFromHeadroom = taxableFrac > 0 ? room / taxableFrac : Infinity;
    const remaining = target - result.withdrawn;
    const take = Math.min(acc.balance, remaining, maxTakeFromHeadroom);
    if (take <= 0) continue;
    const { basisPortion, taxablePortion } = proRataBasis(acc, take);
    acc.balance -= take;
    acc.costBasis = Math.max(0, acc.costBasis - basisPortion);
    result.withdrawn += take;
    result.ordinaryTaxable += taxablePortion;
    runningTaxablePulled += taxablePortion;
    result.perAccount.push({ id: acc.id, amount: take, ordinaryTaxable: taxablePortion, ltcgTaxable: 0 });
  }

  // Step 2: remaining target from taxable
  if (result.withdrawn < target) {
    const remaining = target - result.withdrawn;
    const taxableOrder = accounts.filter((a) => a.type === 'taxable' && a.balance > 0);
    const w = withdrawFromAccounts(accounts, taxableOrder, remaining);
    result.withdrawn += w.withdrawn;
    result.ordinaryTaxable += w.ordinaryTaxable;
    result.ltcgTaxable += w.ltcgTaxable;
    result.perAccount.push(...w.perAccount);
  }

  // Step 3: still short → remaining traditional/HSA, then Roth
  if (result.withdrawn < target) {
    const remaining = target - result.withdrawn;
    const fallback = [
      ...accounts.filter((a) => (isTraditional(a.type) || a.type === 'hsa') && a.balance > 0),
      ...accounts.filter((a) => isRoth(a.type)),
    ];
    const w = withdrawFromAccounts(accounts, fallback, remaining);
    result.withdrawn += w.withdrawn;
    result.ordinaryTaxable += w.ordinaryTaxable;
    result.ltcgTaxable += w.ltcgTaxable;
    result.perAccount.push(...w.perAccount);
  }
  return result;
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
