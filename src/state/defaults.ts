import { Scenario } from '../types';

/**
 * Blank slate - minimal valid scenario with no accounts, no income, zero spending.
 * Use for the "Clear all data" action; the wizard can be filled in from there.
 */
export function makeBlankScenario(): Scenario {
  const thisYear = new Date().getFullYear();
  return {
    schemaVersion: 1,
    startYear: thisYear,
    household: {
      filingStatus: 'single',
      primary: {
        id: 'primary',
        name: '',
        birthYear: thisYear - 50,
        state: 'CA',
        ssBenefitAt67: 0,
        ssClaimAge: 67,
      },
      planEndAge: 95,
    },
    accounts: [],
    incomeStreams: [],
    spending: {
      baseAnnual: 0,
      inflation: 0.025,
      healthcarePre65Annual: 0,
      oneOffs: [],
    },
    assumptions: {
      inflation: 0.025,
      discountRate: 0.03,
      taxLawMode: 'current-law',
      indexTablesToInflation: true,
      heirMarginalTaxRate: 0.24,
    },
    strategy: {
      rothConversions: {},
      withdrawalPolicy: 'conventional',
      ssClaimAges: {},
      label: 'Current plan',
    },
  };
}

export function makeDefaultScenario(): Scenario {
  const thisYear = new Date().getFullYear();
  return {
    schemaVersion: 1,
    startYear: thisYear,
    household: {
      filingStatus: 'mfj',
      primary: {
        id: 'primary',
        name: 'Alex',
        birthYear: thisYear - 60,
        state: 'CA',
        ssBenefitAt67: 36000,
        ssClaimAge: 67,
      },
      spouse: {
        id: 'spouse',
        name: 'Jordan',
        birthYear: thisYear - 58,
        state: 'CA',
        ssBenefitAt67: 30000,
        ssClaimAge: 67,
      },
      planEndAge: 95,
    },
    accounts: [
      {
        id: 'trad-p',
        ownerId: 'primary',
        type: 'traditional-ira',
        label: 'Traditional IRA (Alex)',
        balance: 800000,
        expectedReturn: 0.06,
        annualContribution: 0,
      },
      {
        id: 'roth-p',
        ownerId: 'primary',
        type: 'roth-ira',
        label: 'Roth IRA (Alex)',
        balance: 120000,
        expectedReturn: 0.06,
        annualContribution: 0,
      },
      {
        id: 'trad-s',
        ownerId: 'spouse',
        type: 'traditional-401k',
        label: '401(k) (Jordan)',
        balance: 450000,
        expectedReturn: 0.06,
        annualContribution: 0,
      },
      {
        id: 'taxable',
        ownerId: 'primary',
        type: 'taxable',
        label: 'Brokerage',
        balance: 300000,
        costBasis: 180000,
        expectedReturn: 0.05,
        annualContribution: 0,
      },
    ],
    incomeStreams: [
      {
        id: 'salary-p',
        ownerId: 'primary',
        label: 'Salary (Alex)',
        kind: 'salary',
        annualAmount: 120000,
        taxablePercent: 1,
        startYear: thisYear,
        endYear: thisYear + 5,
        cola: 0.03,
      },
    ],
    spending: {
      baseAnnual: 95000,
      inflation: 0.025,
      healthcarePre65Annual: 12000,
      oneOffs: [],
    },
    assumptions: {
      inflation: 0.025,
      discountRate: 0.03,
      taxLawMode: 'current-law',
      indexTablesToInflation: true,
      heirMarginalTaxRate: 0.24,
    },
    strategy: {
      rothConversions: {},
      withdrawalPolicy: 'conventional',
      ssClaimAges: {},
      label: 'Current plan',
    },
  };
}
