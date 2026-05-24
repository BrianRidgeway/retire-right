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
 * Full Retirement Age in years (fractional, e.g. 66.5 = 66 years 6 months) per SSA tables.
 * Anyone born 1960 or later has FRA = 67.
 */
export function fraForBirthYear(birthYear: number): number {
  if (birthYear <= 1937) return 65;
  if (birthYear === 1938) return 65 + 2 / 12;
  if (birthYear === 1939) return 65 + 4 / 12;
  if (birthYear === 1940) return 65 + 6 / 12;
  if (birthYear === 1941) return 65 + 8 / 12;
  if (birthYear === 1942) return 65 + 10 / 12;
  if (birthYear >= 1943 && birthYear <= 1954) return 66;
  if (birthYear === 1955) return 66 + 2 / 12;
  if (birthYear === 1956) return 66 + 4 / 12;
  if (birthYear === 1957) return 66 + 6 / 12;
  if (birthYear === 1958) return 66 + 8 / 12;
  if (birthYear === 1959) return 66 + 10 / 12;
  return 67;
}

/**
 * Delayed retirement credit per year, per SSA. 8%/yr for everyone born 1943 or later;
 * smaller for older cohorts. The relevant cohorts for this tool are almost always 1943+.
 */
function delayedCreditPerYear(birthYear: number): number {
  if (birthYear >= 1943) return 0.08;
  if (birthYear >= 1941) return 0.075;
  if (birthYear >= 1939) return 0.07;
  if (birthYear >= 1937) return 0.065;
  return 0.06;
}

/**
 * Claim-age benefit multiplier applied to the user-supplied PIA (benefit at FRA).
 * Early claim: reduction of 5/9% per month for first 36 months before FRA, then 5/12% beyond.
 * Delayed claim: delayed retirement credit per year up to age 70.
 */
export function ssClaimAgeMultiplier(claimAge: number, birthYear: number): number {
  if (claimAge < 62) return 0;
  if (claimAge > 70) claimAge = 70;
  const fra = fraForBirthYear(birthYear);
  if (Math.abs(claimAge - fra) < 1 / 24) return 1; // within half a month of FRA
  if (claimAge < fra) {
    const monthsEarly = (fra - claimAge) * 12;
    const firstChunk = Math.min(36, monthsEarly);
    const secondChunk = Math.max(0, monthsEarly - 36);
    const reduction = firstChunk * (5 / 900) + secondChunk * (5 / 1200);
    return Math.max(0, 1 - reduction);
  }
  const yearsDelayed = claimAge - fra;
  return 1 + yearsDelayed * delayedCreditPerYear(birthYear);
}
