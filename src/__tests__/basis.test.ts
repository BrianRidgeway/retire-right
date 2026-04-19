import { describe, it, expect } from 'vitest';
import {
  convertTraditionalToRoth,
  initAccountState,
  withdrawFromAccounts,
} from '../engine/accounts';
import { Account } from '../types';

function makeAcc(a: Partial<Account>): Account {
  return {
    id: a.id ?? 'a',
    ownerId: a.ownerId ?? 'o',
    type: a.type ?? 'traditional-ira',
    label: a.label ?? 'test',
    balance: a.balance ?? 0,
    expectedReturn: a.expectedReturn ?? 0,
    annualContribution: 0,
    costBasis: a.costBasis,
  };
}

describe('initAccountState defaults', () => {
  it('traditional IRA defaults to 0 basis (fully pre-tax)', () => {
    const s = initAccountState(makeAcc({ type: 'traditional-ira', balance: 500000 }));
    expect(s.costBasis).toBe(0);
  });
  it('Roth IRA defaults basis to full balance (all tax-free)', () => {
    const s = initAccountState(makeAcc({ type: 'roth-ira', balance: 100000 }));
    expect(s.costBasis).toBe(100000);
  });
  it('taxable defaults basis to balance (no unrealized gain)', () => {
    const s = initAccountState(makeAcc({ type: 'taxable', balance: 200000 }));
    expect(s.costBasis).toBe(200000);
  });
  it('honors user-supplied basis', () => {
    const s = initAccountState(makeAcc({ type: 'traditional-ira', balance: 500000, costBasis: 50000 }));
    expect(s.costBasis).toBe(50000);
  });
});

describe('pro-rata withdrawal from traditional IRA with basis', () => {
  it('10% basis → 10% tax-free, 90% ordinary taxable', () => {
    const acc = initAccountState(
      makeAcc({ type: 'traditional-ira', balance: 500000, costBasis: 50000 }),
    );
    const result = withdrawFromAccounts([acc], [acc], 50000);
    expect(result.withdrawn).toBe(50000);
    // 50k basis / 500k balance = 10% → 5000 tax-free, 45000 taxable.
    expect(result.ordinaryTaxable).toBeCloseTo(45000, 2);
    expect(acc.costBasis).toBeCloseTo(45000, 2); // 5000 of basis consumed
    expect(acc.balance).toBe(450000);
  });

  it('0 basis → 100% ordinary taxable', () => {
    const acc = initAccountState(makeAcc({ type: 'traditional-ira', balance: 500000 }));
    const result = withdrawFromAccounts([acc], [acc], 20000);
    expect(result.ordinaryTaxable).toBe(20000);
    expect(acc.costBasis).toBe(0);
  });

  it('full basis → 0% taxable (impossible for real traditional but boundary case)', () => {
    const acc = initAccountState(
      makeAcc({ type: 'traditional-ira', balance: 100000, costBasis: 100000 }),
    );
    const result = withdrawFromAccounts([acc], [acc], 30000);
    expect(result.ordinaryTaxable).toBe(0);
    expect(acc.costBasis).toBe(70000);
  });
});

describe('pro-rata Roth conversion', () => {
  it('20% basis → 20% of conversion is tax-free, 80% taxable', () => {
    const trad = initAccountState(
      makeAcc({ id: 't', type: 'traditional-ira', balance: 500000, costBasis: 100000 }),
    );
    const roth = initAccountState(
      makeAcc({ id: 'r', type: 'roth-ira', balance: 50000 }),
    );
    const accounts = [trad, roth];
    const result = convertTraditionalToRoth(accounts, 'o', 100000);
    expect(result.converted).toBe(100000);
    expect(result.taxable).toBeCloseTo(80000, 2);
    expect(result.basisTransferred).toBeCloseTo(20000, 2);
    // Traditional: balance 400k, basis 80k (consumed 20k basis)
    expect(trad.balance).toBe(400000);
    expect(trad.costBasis).toBeCloseTo(80000, 2);
    // Roth received the full 100k, all becomes Roth basis (tax-free forever)
    expect(roth.balance).toBe(150000);
    expect(roth.costBasis).toBe(150000);
  });

  it('0 basis → conversion fully taxable', () => {
    const trad = initAccountState(makeAcc({ id: 't', type: 'traditional-ira', balance: 500000 }));
    const roth = initAccountState(makeAcc({ id: 'r', type: 'roth-ira', balance: 0 }));
    const result = convertTraditionalToRoth([trad, roth], 'o', 40000);
    expect(result.taxable).toBe(40000);
    expect(result.basisTransferred).toBe(0);
  });
});

describe('Roth withdrawal is always tax-free', () => {
  it('neither ordinary nor LTCG taxable', () => {
    const acc = initAccountState(makeAcc({ type: 'roth-ira', balance: 200000 }));
    const result = withdrawFromAccounts([acc], [acc], 50000);
    expect(result.ordinaryTaxable).toBe(0);
    expect(result.ltcgTaxable).toBe(0);
  });
});

describe('taxable brokerage with cost basis', () => {
  it('50% basis → 50% of withdrawal is LTCG', () => {
    const acc = initAccountState(
      makeAcc({ type: 'taxable', balance: 200000, costBasis: 100000 }),
    );
    const result = withdrawFromAccounts([acc], [acc], 40000);
    expect(result.ltcgTaxable).toBeCloseTo(20000, 2);
    expect(acc.costBasis).toBeCloseTo(80000, 2);
  });
});
