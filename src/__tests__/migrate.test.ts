import { describe, it, expect } from 'vitest';
import { migrateScenario } from '../persistence/migrate';
import { ScenarioSchema } from '../types';

describe('migrateScenario v1 → v2', () => {
  const v1 = {
    schemaVersion: 1,
    startYear: 2026,
    household: {
      filingStatus: 'mfj',
      primary: {
        id: 'primary',
        name: 'G',
        birthYear: 1954,
        state: 'MD',
        ssBenefitAt67: 38875,
        ssClaimAge: 66,
        ssAlreadyClaimed: false,
        ssCurrentAnnualBenefit: 0,
      },
      spouse: {
        id: 'spouse',
        name: 'C',
        birthYear: 1957,
        state: 'MD',
        ssBenefitAt67: 16248,
        ssClaimAge: 64,
        ssAlreadyClaimed: false,
        ssCurrentAnnualBenefit: 0,
      },
      planEndAge: 100,
    },
    accounts: [
      {
        id: 'a1',
        ownerId: 'primary',
        type: 'traditional-ira',
        label: 'IRA',
        balance: 1000000,
        expectedReturn: 0.05,
        annualContribution: 0,
      },
    ],
    incomeStreams: [
      {
        id: 'p1',
        ownerId: 'primary',
        label: 'Pension',
        kind: 'pension',
        annualAmount: 60000,
        taxablePercent: 1,
        startYear: 2026,
        cola: 0.02,
      },
    ],
    spending: { baseAnnual: 76000, inflation: 0.025, healthcarePre65Annual: 0, oneOffs: [] },
    assumptions: {
      inflation: 0.025,
      discountRate: 0.03,
      taxLawMode: 'current-law',
      indexTablesToInflation: true,
      heirMarginalTaxRate: 0.24,
    },
    strategy: { rothConversions: {}, withdrawalPolicy: 'conventional', ssClaimAges: {}, label: 'Current plan' },
  };

  it('renames ssBenefitAt67 → ssBenefitAtFra on primary and spouse', () => {
    const { migrated, changes } = migrateScenario(v1);
    const m = migrated as any;
    expect(m.household.primary.ssBenefitAtFra).toBe(38875);
    expect(m.household.primary.ssBenefitAt67).toBeUndefined();
    expect(m.household.spouse.ssBenefitAtFra).toBe(16248);
    expect(changes.some((c) => c.includes('ssBenefitAt67'))).toBe(true);
  });

  it('adds survivorPct=1 to income streams that lack it', () => {
    const { migrated, changes } = migrateScenario(v1);
    const m = migrated as any;
    expect(m.incomeStreams[0].survivorPct).toBe(1);
    expect(changes.some((c) => c.includes('survivorPct'))).toBe(true);
  });

  it('adds spending.annualCharitableGiving=0', () => {
    const { migrated, changes } = migrateScenario(v1);
    const m = migrated as any;
    expect(m.spending.annualCharitableGiving).toBe(0);
    expect(changes.some((c) => c.includes('annualCharitableGiving'))).toBe(true);
  });

  it('adds assumptions.heirs=[]', () => {
    const { migrated, changes } = migrateScenario(v1);
    const m = migrated as any;
    expect(m.assumptions.heirs).toEqual([]);
    expect(changes.some((c) => c.includes('heirs'))).toBe(true);
  });

  it('bumps schemaVersion to 2', () => {
    const { migrated } = migrateScenario(v1);
    expect((migrated as any).schemaVersion).toBe(2);
  });

  it('migrated v1 passes current ScenarioSchema validation', () => {
    const { migrated } = migrateScenario(v1);
    const result = ScenarioSchema.safeParse(migrated);
    expect(result.success).toBe(true);
  });

  it('no-ops on a v2 scenario', () => {
    const v2 = { ...v1, schemaVersion: 2 };
    const { migrated, changes } = migrateScenario(v2);
    expect(migrated).toBe(v2); // same reference
    expect(changes).toEqual([]);
  });

  it('preserves user choice of taxLawMode (does NOT auto-flip current-law → obbba)', () => {
    const { migrated } = migrateScenario(v1);
    expect((migrated as any).assumptions.taxLawMode).toBe('current-law');
  });

  it('preserves existing survivorPct when already set on a stream', () => {
    const partial = {
      ...v1,
      incomeStreams: [{ ...v1.incomeStreams[0], survivorPct: 0.5 }],
    };
    const { migrated } = migrateScenario(partial);
    expect((migrated as any).incomeStreams[0].survivorPct).toBe(0.5);
  });
});
