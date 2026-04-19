import { RMD } from './tables';

export function rmdApplicableAge(birthYear: number): number {
  if (birthYear < 1951) return RMD.applicableAge.bornBefore1951;
  if (birthYear < 1960) return RMD.applicableAge.born1951to1959;
  return RMD.applicableAge.born1960orLater;
}

export function uniformLifetimeDivisor(age: number): number | null {
  const key = String(Math.floor(age));
  const divisor = (RMD.uniformLifetime as Record<string, number>)[key];
  return divisor ?? null;
}

/**
 * Compute the RMD amount for a single traditional account given end-of-prior-year balance and the owner's current age.
 * Returns 0 if age is below applicable RMD age, or if no divisor is available.
 */
export function computeRmd(params: {
  priorYearEndBalance: number;
  ownerAge: number;
  ownerBirthYear: number;
}): number {
  const { priorYearEndBalance, ownerAge, ownerBirthYear } = params;
  if (priorYearEndBalance <= 0) return 0;
  if (ownerAge < rmdApplicableAge(ownerBirthYear)) return 0;
  const divisor = uniformLifetimeDivisor(ownerAge);
  if (divisor == null) return priorYearEndBalance;
  return priorYearEndBalance / divisor;
}
