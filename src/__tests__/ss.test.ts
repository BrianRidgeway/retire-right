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

describe('ssClaimAgeMultiplier', () => {
  it('FRA (67) gives 1.0', () => {
    expect(ssClaimAgeMultiplier(67)).toBeCloseTo(1.0, 4);
  });
  it('Age 70 gives +24%', () => {
    expect(ssClaimAgeMultiplier(70)).toBeCloseTo(1.24, 3);
  });
  it('Age 62 gives 30% reduction', () => {
    // 60 months early: 36*(5/9)/100 + 24*(5/12)/100 = 20 + 10 = 30%
    expect(ssClaimAgeMultiplier(62)).toBeCloseTo(0.7, 3);
  });
  it('Age 65 gives ~13.33% reduction', () => {
    // 24 months early: 24 * (5/9) / 100 = 13.333%
    expect(ssClaimAgeMultiplier(65)).toBeCloseTo(1 - 24 * (5 / 900), 4);
  });
});
