import { describe, it, expect } from 'vitest';
import { computeFederalTax, taxFromBrackets, standardDeduction } from '../engine/tax/federal';
import { FEDERAL } from '../engine/tables';

describe('taxFromBrackets', () => {
  it('returns 0 for zero or negative income', () => {
    expect(taxFromBrackets(0, FEDERAL.ordinaryBrackets.single)).toBe(0);
    expect(taxFromBrackets(-1000, FEDERAL.ordinaryBrackets.single)).toBe(0);
  });

  it('computes single-bracket tax correctly (Single, $10,000 → 10%)', () => {
    // $10,000 is within first bracket (10%): tax = 1000
    expect(taxFromBrackets(10000, FEDERAL.ordinaryBrackets.single)).toBeCloseTo(1000, 2);
  });

  it('computes multi-bracket tax (Single, $50,000)', () => {
    // 10% on 0-11925 = 1192.50
    // 12% on 11925-48475 = 0.12 * 36550 = 4386
    // 22% on 48475-50000 = 0.22 * 1525 = 335.50
    // total = 5914.00
    expect(taxFromBrackets(50000, FEDERAL.ordinaryBrackets.single)).toBeCloseTo(5914.0, 2);
  });

  it('computes multi-bracket tax (MFJ, $200,000)', () => {
    // 10% on 0-23850 = 2385
    // 12% on 23850-96950 = 8772
    // 22% on 96950-200000 = 22671
    // total = 33828
    expect(taxFromBrackets(200000, FEDERAL.ordinaryBrackets.mfj)).toBeCloseTo(33828, 2);
  });
});

describe('standardDeduction', () => {
  it('2025 Single under 65', () => {
    expect(standardDeduction('single', 50)).toBe(15000);
  });
  it('2025 MFJ under 65', () => {
    expect(standardDeduction('mfj', 50, 50)).toBe(30000);
  });
  it('2025 Single age 65+', () => {
    expect(standardDeduction('single', 70)).toBe(17000);
  });
  it('2025 MFJ both 65+', () => {
    expect(standardDeduction('mfj', 70, 70)).toBe(33200);
  });
  it('2025 MFJ only one 65+', () => {
    expect(standardDeduction('mfj', 70, 60)).toBe(31600);
  });
});

describe('computeFederalTax with LTCG stacking', () => {
  it('LTCG fully in 0% bracket when ordinary is very low (MFJ)', () => {
    // MFJ, ordinary=30000, LTCG=20000, SD=30000.
    // taxable ordinary = 0, taxable LTCG = 20000 (all below MFJ 0% top of 96700).
    const r = computeFederalTax({ status: 'mfj', ordinaryIncome: 30000, ltcgIncome: 20000, standardDeduction: 30000 });
    expect(r.ordinaryTax).toBe(0);
    expect(r.ltcgTax).toBe(0);
    expect(r.totalTax).toBe(0);
  });

  it('LTCG partially above 0% bracket (MFJ)', () => {
    // MFJ, ordinary=100000, LTCG=20000, SD=30000
    // taxable ordinary = 70000 (below 96950 → within 12% bracket top).
    // LTCG stacks at 70000; 0% bracket tops at 96700 → first 26700 of LTCG at 0%, none above because LTCG=20000<26700.
    const r = computeFederalTax({ status: 'mfj', ordinaryIncome: 100000, ltcgIncome: 20000, standardDeduction: 30000 });
    expect(r.ltcgTax).toBeCloseTo(0, 2);
  });

  it('LTCG crosses 15% threshold (MFJ)', () => {
    // MFJ, ordinary = 120000, LTCG = 30000, SD = 30000
    // taxable ordinary = 90000
    // LTCG stacks at 90000; 0% top at 96700 → first 6700 at 0%, remaining 23300 at 15% → 3495
    const r = computeFederalTax({ status: 'mfj', ordinaryIncome: 120000, ltcgIncome: 30000, standardDeduction: 30000 });
    expect(r.ltcgTax).toBeCloseTo(3495, 1);
  });
});
