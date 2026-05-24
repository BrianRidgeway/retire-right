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
 * (so TCJA-sunset years use the pre-TCJA standard deduction). Falls back to FEDERAL.
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
