import { describe, it, expect } from 'vitest';
import { heirNetForAccount, heirNetValue } from '../engine/heir';
import { initAccountState } from '../engine/accounts';
import { Account } from '../types';

function acc(a: Partial<Account>): Account {
  return {
    id: a.id ?? 'a',
    ownerId: 'o',
    type: a.type ?? 'traditional-ira',
    label: 'x',
    balance: a.balance ?? 0,
    expectedReturn: 0,
    annualContribution: 0,
    costBasis: a.costBasis,
  };
}

describe('heirNetForAccount', () => {
  it('traditional IRA with no basis: full balance × (1 - heir rate)', () => {
    const s = initAccountState(acc({ type: 'traditional-ira', balance: 1_000_000 }));
    expect(heirNetForAccount(s, 0.24)).toBeCloseTo(760_000, 2);
  });

  it('traditional IRA with basis: basis passes tax-free, rest taxed at heir rate', () => {
    const s = initAccountState(
      acc({ type: 'traditional-ira', balance: 500_000, costBasis: 100_000 }),
    );
    // basis 100k passes free, 400k taxed at 24% → 304k → total 404k
    expect(heirNetForAccount(s, 0.24)).toBeCloseTo(404_000, 2);
  });

  it('Roth IRA: full balance passes tax-free regardless of rate', () => {
    const s = initAccountState(acc({ type: 'roth-ira', balance: 500_000 }));
    expect(heirNetForAccount(s, 0.5)).toBe(500_000);
  });

  it('taxable brokerage: step-up in basis wipes unrealized gains', () => {
    const s = initAccountState(acc({ type: 'taxable', balance: 300_000, costBasis: 50_000 }));
    expect(heirNetForAccount(s, 0.24)).toBe(300_000);
  });

  it('HSA: treated like traditional for non-spouse heir', () => {
    const s = initAccountState(acc({ type: 'hsa', balance: 100_000 }));
    expect(heirNetForAccount(s, 0.3)).toBeCloseTo(70_000, 2);
  });

  it('heirNetValue sums across mixed portfolio', () => {
    const accs = [
      initAccountState(acc({ id: '1', type: 'traditional-ira', balance: 1_000_000 })),
      initAccountState(acc({ id: '2', type: 'roth-ira', balance: 500_000 })),
      initAccountState(acc({ id: '3', type: 'taxable', balance: 400_000, costBasis: 100_000 })),
    ];
    // 760k + 500k + 400k = 1.66M
    expect(heirNetValue(accs, 0.24)).toBeCloseTo(1_660_000, 2);
  });

  it('heir rate of 0 → heir net == face value', () => {
    const accs = [
      initAccountState(acc({ type: 'traditional-ira', balance: 500_000 })),
      initAccountState(acc({ type: 'roth-ira', balance: 200_000 })),
    ];
    expect(heirNetValue(accs, 0)).toBe(700_000);
  });
});

describe('Roth conversion shifts heir-net value at a higher rate than you pay', () => {
  it('when heir bracket > your bracket, conversion increases heir-net even if you pay tax now', () => {
    // Mini illustration: compare a $100k traditional balance left alone vs converted to Roth.
    // Left alone: 100k × (1 - 0.24) = 76k to heirs.
    // Converted at 22% your-bracket: you pay 22k tax, 78k lands in Roth → 78k to heirs.
    // So 78k > 76k if heir-rate (24%) > your-rate (22%).
    const traditional = initAccountState(acc({ type: 'traditional-ira', balance: 100_000 }));
    const roth = initAccountState(acc({ type: 'roth-ira', balance: 78_000 }));
    const leftAlone = heirNetForAccount(traditional, 0.24);
    const converted = heirNetForAccount(roth, 0.24);
    expect(converted).toBeGreaterThan(leftAlone);
  });
});
