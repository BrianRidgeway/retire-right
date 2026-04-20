import { FEDERAL, StatusKey } from '../tables';

/**
 * Compute taxable portion of Social Security benefits using the IRS provisional-income method.
 * Provisional income = AGI-excluding-SS + tax-exempt interest + 0.5 * SS benefits.
 * - If provisional <= tier1: 0% of SS is taxable
 * - If tier1 < provisional <= tier2: lesser of 0.5*(provisional - tier1) or 0.5*SS
 * - If provisional > tier2: 0.85*(provisional - tier2) + lesser of 0.5*SS or 0.5*(tier2-tier1), capped at 0.85*SS
 */
export function computeSocialSecurityTaxable(params: {
  status: StatusKey;
  ssBenefits: number;
  otherOrdinaryIncome: number; // wages, pension, IRA withdrawals, taxable interest, etc.
  ltcgAndQualifiedDivs: number;
  taxExemptInterest?: number;
}): number {
  const { status, ssBenefits, otherOrdinaryIncome, ltcgAndQualifiedDivs, taxExemptInterest = 0 } = params;
  if (ssBenefits <= 0) return 0;
  const { tier1, tier2 } = FEDERAL.ssTaxability[status];
  const provisional =
    otherOrdinaryIncome + ltcgAndQualifiedDivs + taxExemptInterest + 0.5 * ssBenefits;

  if (provisional <= tier1) return 0;

  if (provisional <= tier2) {
    return Math.min(0.5 * (provisional - tier1), 0.5 * ssBenefits);
  }

  const over2 = 0.85 * (provisional - tier2);
  const tier2Contribution = Math.min(0.5 * ssBenefits, 0.5 * (tier2 - tier1));
  return Math.min(over2 + tier2Contribution, 0.85 * ssBenefits);
}

/**
 * Claim-age benefit adjustment relative to Full Retirement Age (assumed 67 for simplicity - correct for anyone born 1960+).
 * Early claim: reduction of 5/9% per month for first 36 months before FRA, then 5/12% for additional months.
 * Delayed claim: +8%/year (2/3%/month) up to age 70.
 * Returns a multiplier applied to the user-supplied FRA benefit.
 */
export function ssClaimAgeMultiplier(claimAge: number): number {
  if (claimAge < 62) return 0;
  if (claimAge > 70) claimAge = 70;
  const fra = 67;
  if (claimAge === fra) return 1;
  if (claimAge < fra) {
    const monthsEarly = (fra - claimAge) * 12;
    const firstChunk = Math.min(36, monthsEarly);
    const secondChunk = Math.max(0, monthsEarly - 36);
    const reduction = firstChunk * (5 / 900) + secondChunk * (5 / 1200);
    return Math.max(0, 1 - reduction);
  }
  const monthsDelayed = (claimAge - fra) * 12;
  return 1 + monthsDelayed * (2 / 300);
}
