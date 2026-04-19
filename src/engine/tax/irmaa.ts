import { IRMAA, StatusKey } from '../tables';

export type IrmaaResult = {
  tier: number;
  partBPremium: number;
  partDSurcharge: number;
  annualPerPerson: number;
};

/**
 * IRMAA for a given plan year uses MAGI from two years prior (Y-2 lookback).
 * The caller is responsible for supplying the correct MAGI.
 */
export function computeIrmaaTier(magi: number, status: StatusKey): IrmaaResult {
  const tiers = IRMAA.tiers[status];
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (t.magiMax == null || magi <= t.magiMax) {
      return {
        tier: i,
        partBPremium: t.partBPremium,
        partDSurcharge: t.partDSurcharge,
        annualPerPerson: 12 * (t.partBPremium + t.partDSurcharge),
      };
    }
  }
  const last = tiers[tiers.length - 1];
  return {
    tier: tiers.length - 1,
    partBPremium: last.partBPremium,
    partDSurcharge: last.partDSurcharge,
    annualPerPerson: 12 * (last.partBPremium + last.partDSurcharge),
  };
}

/**
 * IRMAA thresholds (bottom of tier N) — useful for the optimizer to target conversion ceilings.
 */
export function irmaaTierCeilings(status: StatusKey): number[] {
  return IRMAA.tiers[status]
    .map((t) => t.magiMax)
    .filter((v): v is number => v != null);
}
