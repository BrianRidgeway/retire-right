import { describe, it, expect } from 'vitest';
import { computeSocialSecurityTaxable, ssClaimAgeMultiplier } from '../engine/tax/ss';

describe('computeSocialSecurityTaxable (MFJ)', () => {
  it('0% taxable when provisional income is below tier1 ($32,000)', () => {
    // MFJ couple, SS=$20,000, other=$15,000 → provisional = 15000 + 10000 = 25000 < 32000
    expect(
      computeSocialSecurityTaxable({
        status: 'mfj',
        ssBenefits: 20000,
        otherOrdinaryIncome: 15000,
        ltcgAndQualifiedDivs: 0,
      }),
    ).toBe(0);
  });

  it('Up to 50% taxable between tier1 and tier2 (MFJ)', () => {
    // SS=$20,000, other=$30,000 → provisional = 30000 + 10000 = 40000, between 32000 and 44000.
    // min(0.5*(40000-32000), 0.5*20000) = min(4000, 10000) = 4000
    expect(
      computeSocialSecurityTaxable({
        status: 'mfj',
        ssBenefits: 20000,
        otherOrdinaryIncome: 30000,
        ltcgAndQualifiedDivs: 0,
      }),
    ).toBeCloseTo(4000, 2);
  });

  it('Up to 85% taxable above tier2 (MFJ)', () => {
    // SS=$40,000, other=$80,000 → provisional = 80000 + 20000 = 100000
    // over2 = 0.85 * (100000 - 44000) = 0.85 * 56000 = 47600
    // tier2Contribution = min(0.5*40000, 0.5*(44000-32000)) = min(20000, 6000) = 6000
    // candidate = 47600 + 6000 = 53600, cap at 0.85*40000 = 34000
    expect(
      computeSocialSecurityTaxable({
        status: 'mfj',
        ssBenefits: 40000,
        otherOrdinaryIncome: 80000,
        ltcgAndQualifiedDivs: 0,
      }),
    ).toBeCloseTo(34000, 2);
  });
});

describe('ssClaimAgeMultiplier (born 1960+, FRA 67)', () => {
  const by = 1965;
  it('FRA (67) gives 1.0', () => {
    expect(ssClaimAgeMultiplier(67, by)).toBeCloseTo(1.0, 4);
  });
  it('Age 70 gives +24%', () => {
    expect(ssClaimAgeMultiplier(70, by)).toBeCloseTo(1.24, 3);
  });
  it('Age 62 gives 30% reduction', () => {
    expect(ssClaimAgeMultiplier(62, by)).toBeCloseTo(0.7, 3);
  });
  it('Age 65 gives ~13.33% reduction', () => {
    expect(ssClaimAgeMultiplier(65, by)).toBeCloseTo(1 - 24 * (5 / 900), 4);
  });
});

describe('ssClaimAgeMultiplier (per-birth-year FRA)', () => {
  it('born 1954 (FRA 66): claiming at 66 = 1.0', () => {
    expect(ssClaimAgeMultiplier(66, 1954)).toBeCloseTo(1.0, 4);
  });
  it('born 1954: claiming at 70 = +32% (4 years × 8%)', () => {
    expect(ssClaimAgeMultiplier(70, 1954)).toBeCloseTo(1.32, 3);
  });
  it('born 1957 (FRA 66.5): claiming at 67 = +4% (6 months delay × 8%/yr)', () => {
    expect(ssClaimAgeMultiplier(67, 1957)).toBeCloseTo(1.04, 3);
  });
  it('born 1957: claiming at 66.5 = 1.0', () => {
    expect(ssClaimAgeMultiplier(66.5, 1957)).toBeCloseTo(1.0, 4);
  });
  it('born 1957: claiming at 62 = 27.5% reduction (54 months early: 36×5/9 + 18×5/12 = 20 + 7.5)', () => {
    expect(ssClaimAgeMultiplier(62, 1957)).toBeCloseTo(0.725, 3);
  });
});
