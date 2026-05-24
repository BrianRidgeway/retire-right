import { FEDERAL, FederalTables, Bracket, StatusKey } from '../tables';

export function taxFromBrackets(income: number, brackets: Bracket[]): number {
  if (income <= 0) return 0;
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    const top = b.max == null ? income : Math.min(income, b.max);
    tax += (top - b.min) * b.rate;
    if (b.max != null && income <= b.max) break;
  }
  return tax;
}

/**
 * Standard deduction for the given filing status and ages. Uses the supplied federal table
 * (so TCJA-sunset years use the pre-TCJA standard deduction). Includes the existing per-spouse
 * 65+ additional standard deduction ($1,600 MFJ / $2,000 single for 2025).
 *
 * The OBBBA senior bonus ($6,000 per senior 65+, 2025-2028) is computed separately by
 * obbbaSeniorBonus() because it has an AGI-based phaseout.
 */
export function standardDeduction(
  status: StatusKey,
  primaryAge: number,
  spouseAge?: number,
  tables: FederalTables = FEDERAL,
): number {
  const base = tables.standardDeduction[status];
  const extra = tables.standardDeduction.age65Extra[status];
  let add = 0;
  if (primaryAge >= 65) add += extra;
  if (status === 'mfj' && spouseAge != null && spouseAge >= 65) add += extra;
  return base + add;
}

const OBBBA_SENIOR_BONUS = 6000;
const OBBBA_PHASEOUT_RATE = 0.06; // 6 cents per dollar over threshold
const OBBBA_PHASEOUT_START = { single: 75_000, mfj: 150_000 };
const OBBBA_FIRST_YEAR = 2025;
const OBBBA_LAST_YEAR = 2028;

/**
 * OBBBA "senior bonus" — additional $6,000 standard deduction per qualifying senior (age 65+),
 * effective tax years 2025-2028 only (sunsets after 2028 unless extended). Phases out at 6% of
 * AGI over $75K single / $150K MFJ — fully gone at $175K single / $250K MFJ.
 *
 * Returns 0 if tax-law mode is anything other than 'obbba', or outside the 2025-2028 window,
 * or no qualifying seniors in the household.
 */
export function obbbaSeniorBonus(params: {
  year: number;
  mode: 'current-law' | 'tcja-sunset' | 'obbba';
  status: StatusKey;
  primaryAge: number;
  spouseAge?: number;
  agi: number;
}): number {
  if (params.mode !== 'obbba') return 0;
  if (params.year < OBBBA_FIRST_YEAR || params.year > OBBBA_LAST_YEAR) return 0;

  let qualifyingSeniors = 0;
  if (params.primaryAge >= 65) qualifyingSeniors++;
  if (params.status === 'mfj' && params.spouseAge != null && params.spouseAge >= 65) qualifyingSeniors++;
  if (qualifyingSeniors === 0) return 0;

  const baseBonus = OBBBA_SENIOR_BONUS * qualifyingSeniors;
  const phaseoutStart = OBBBA_PHASEOUT_START[params.status];
  const overage = Math.max(0, params.agi - phaseoutStart);
  const reduction = overage * OBBBA_PHASEOUT_RATE;
  return Math.max(0, baseBonus - reduction);
}

export type FederalTaxInput = {
  status: StatusKey;
  ordinaryIncome: number;
  ltcgIncome: number;
  standardDeduction: number;
  /** Federal tables to use for this computation (default = current law). */
  tables?: FederalTables;
};

export type FederalTaxOutput = {
  taxableOrdinary: number;
  taxableLtcg: number;
  totalTaxableIncome: number;
  ordinaryTax: number;
  ltcgTax: number;
  totalTax: number;
};

/**
 * Federal tax with LTCG stacking: LTCG sits on top of ordinary taxable income.
 * The portion of LTCG within each LTCG bracket is taxed at that rate.
 */
export function computeFederalTax(input: FederalTaxInput): FederalTaxOutput {
  const { status, ordinaryIncome, ltcgIncome, standardDeduction: sd } = input;
  const tables = input.tables ?? FEDERAL;

  const ltcgSafe = Math.max(0, ltcgIncome);
  const ordinarySafe = Math.max(0, ordinaryIncome);

  // Standard deduction applies to ordinary income first, then LTCG.
  let deductionLeft = sd;
  const taxableOrdinary = Math.max(0, ordinarySafe - Math.min(deductionLeft, ordinarySafe));
  deductionLeft -= Math.min(deductionLeft, ordinarySafe);
  const taxableLtcg = Math.max(0, ltcgSafe - deductionLeft);

  const totalTaxableIncome = taxableOrdinary + taxableLtcg;

  const ordinaryBrackets = tables.ordinaryBrackets[status];
  const ordinaryTax = taxFromBrackets(taxableOrdinary, ordinaryBrackets);

  // LTCG: stacks on top of taxableOrdinary. Apply LTCG brackets to [taxableOrdinary, taxableOrdinary+taxableLtcg].
  const ltcgBrackets = tables.ltcgBrackets[status];
  let ltcgTax = 0;
  let remaining = taxableLtcg;
  let cursor = taxableOrdinary;
  for (const b of ltcgBrackets) {
    if (remaining <= 0) break;
    const bracketTop = b.max == null ? Infinity : b.max;
    if (cursor >= bracketTop) continue;
    const taxableInThis = Math.min(bracketTop - cursor, remaining);
    if (taxableInThis > 0) {
      ltcgTax += taxableInThis * b.rate;
      remaining -= taxableInThis;
      cursor += taxableInThis;
    }
  }

  return {
    taxableOrdinary,
    taxableLtcg,
    totalTaxableIncome,
    ordinaryTax,
    ltcgTax,
    totalTax: ordinaryTax + ltcgTax,
  };
}
