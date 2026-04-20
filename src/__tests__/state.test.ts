import { describe, it, expect } from 'vitest';
import { computeStateTax, supportedStates } from '../engine/tax/state';

function base() {
  return {
    status: 'mfj' as const,
    primaryAge: 70,
    wages: 0,
    pension: 0,
    rentalOther: 0,
    socialSecurityGross: 0,
    retirementDistributions: 0,
    taxableCapitalGains: 0,
    interestAndDividends: 0,
  };
}

describe('supportedStates', () => {
  it('includes Maryland', () => {
    expect(supportedStates()).toContain('MD');
  });
  it('includes CA, NY, PA, MD, FL, TX, WA', () => {
    const supported = supportedStates();
    for (const s of ['CA', 'NY', 'PA', 'MD', 'FL', 'TX', 'WA']) {
      expect(supported).toContain(s);
    }
  });
});

describe('Maryland state tax', () => {
  it('applies 3% local surcharge on top of state brackets', () => {
    // $100k wages MFJ, no retirement. SD $5,150.
    // Taxable: 94,850.
    // State tax: 2%*1000 + 3%*1000 + 4%*1000 + 4.75%*(94850-3000) = 20+30+40+4362.875 ≈ 4452.875
    // Local 3% * 94850 = 2845.5
    // Total ≈ 7298.37
    const r = computeStateTax({ ...base(), stateCode: 'MD', wages: 100000, primaryAge: 55 });
    expect(r.tax).toBeCloseTo(7298.38, 1);
  });

  it('exempts up to $39,500 of retirement distributions for age 65+', () => {
    const r = computeStateTax({
      ...base(),
      stateCode: 'MD',
      retirementDistributions: 30000,
      primaryAge: 70,
    });
    // 30k fully exempted (under $39,500) → taxable income = 0 - SD = 0
    expect(r.taxableIncome).toBe(0);
    expect(r.tax).toBe(0);
  });

  it('partial exemption when retirement > $39,500 (MFJ, age 65+)', () => {
    const r = computeStateTax({
      ...base(),
      stateCode: 'MD',
      retirementDistributions: 60000,
      primaryAge: 70,
    });
    // 60k - 39500 = 20500 taxable retirement. SD 5150 → 15350 taxable.
    // Tax: 2%*1000 + 3%*1000 + 4%*1000 + 4.75%*(15350-3000) = 20+30+40+586.625 = 676.625
    // Local 3% * 15350 = 460.5
    // Total ≈ 1137.13
    expect(r.tax).toBeCloseTo(1137.13, 1);
  });

  it('no pension exemption below age 65', () => {
    const r = computeStateTax({
      ...base(),
      stateCode: 'MD',
      retirementDistributions: 30000,
      primaryAge: 62,
    });
    // No exemption (below 65). SD 5150 → 24850 taxable.
    // Tax: 2%+3%+4% on first 3k = 90; 4.75% * (24850-3000) = 1037.875. State = 1127.875.
    // Local 3% * 24850 = 745.5
    // Total ≈ 1873.38
    expect(r.tax).toBeCloseTo(1873.38, 1);
  });
});

describe('NY pension exemption still works at 59.5', () => {
  it('exempts $20k for age 60', () => {
    const r = computeStateTax({
      ...base(),
      stateCode: 'NY',
      retirementDistributions: 30000,
      primaryAge: 60,
    });
    // 30k - 20k exempt = 10k retirement taxable. SD 16050 → 0 taxable income.
    expect(r.taxableIncome).toBe(0);
  });
});

describe('PA retirement exempt at 59.5+', () => {
  it('no tax on IRA withdrawals for age 65', () => {
    const r = computeStateTax({
      ...base(),
      stateCode: 'PA',
      retirementDistributions: 50000,
      primaryAge: 65,
    });
    expect(r.tax).toBe(0);
  });
  it('still exempt when ostensibly early (simplification - we do not model early-withdrawal penalty)', () => {
    // PA technically taxes early withdrawals, but this engine targets retirement-age users.
    const r = computeStateTax({
      ...base(),
      stateCode: 'PA',
      retirementDistributions: 50000,
      primaryAge: 50,
    });
    expect(r.tax).toBe(0);
  });
});
