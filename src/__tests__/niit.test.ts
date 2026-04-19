import { describe, it, expect } from 'vitest';
import { computeNiit } from '../engine/tax/niit';

describe('computeNiit', () => {
  it('no tax when MAGI below threshold (MFJ)', () => {
    expect(computeNiit({ status: 'mfj', magi: 240000, netInvestmentIncome: 50000 })).toBe(0);
  });
  it('applies to excess MAGI when NII > excess (MFJ)', () => {
    // excess = 50000, NII = 100000 → base = 50000 → 50000 * 0.038 = 1900
    expect(computeNiit({ status: 'mfj', magi: 300000, netInvestmentIncome: 100000 })).toBeCloseTo(1900, 2);
  });
  it('applies to NII when NII < excess MAGI (MFJ)', () => {
    // excess = 150000, NII = 20000 → base = 20000 → 20000 * 0.038 = 760
    expect(computeNiit({ status: 'mfj', magi: 400000, netInvestmentIncome: 20000 })).toBeCloseTo(760, 2);
  });
  it('no tax with zero NII', () => {
    expect(computeNiit({ status: 'mfj', magi: 500000, netInvestmentIncome: 0 })).toBe(0);
  });
});
