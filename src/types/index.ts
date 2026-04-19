import { z } from 'zod';

export const FILING_STATUSES = ['single', 'mfj'] as const;
export const FilingStatusSchema = z.enum(FILING_STATUSES);
export type FilingStatus = z.infer<typeof FilingStatusSchema>;

export const ACCOUNT_TYPES = [
  'taxable',
  'traditional-ira',
  'roth-ira',
  'traditional-401k',
  'roth-401k',
  'hsa',
] as const;
export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const WITHDRAWAL_POLICIES = [
  'conventional',
  'proportional',
  'bracket-fill',
] as const;
export const WithdrawalPolicySchema = z.enum(WITHDRAWAL_POLICIES);
export type WithdrawalPolicy = z.infer<typeof WithdrawalPolicySchema>;

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  birthYear: z.number().int().min(1900).max(2100),
  state: z.string().length(2),
  ssBenefitAt67: z.number().min(0),
  ssClaimAge: z.number().min(62).max(70),
});
export type Person = z.infer<typeof PersonSchema>;

export const HouseholdSchema = z.object({
  filingStatus: FilingStatusSchema,
  primary: PersonSchema,
  spouse: PersonSchema.optional(),
  planEndAge: z.number().int().min(70).max(110),
});
export type Household = z.infer<typeof HouseholdSchema>;

export const AccountSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  type: AccountTypeSchema,
  label: z.string(),
  balance: z.number().min(0),
  costBasis: z.number().min(0).optional(),
  expectedReturn: z.number(),
  annualContribution: z.number().min(0).default(0),
  contributionEndYear: z.number().int().optional(),
});
export type Account = z.infer<typeof AccountSchema>;

export const IncomeStreamSchema = z.object({
  id: z.string(),
  ownerId: z.string().optional(),
  label: z.string(),
  kind: z.enum(['salary', 'pension', 'rental', 'other']),
  annualAmount: z.number().min(0),
  taxablePercent: z.number().min(0).max(1).default(1),
  startYear: z.number().int(),
  endYear: z.number().int().optional(),
  cola: z.number().default(0),
});
export type IncomeStream = z.infer<typeof IncomeStreamSchema>;

export const SpendingPlanSchema = z.object({
  baseAnnual: z.number().min(0),
  inflation: z.number().default(0.025),
  healthcarePre65Annual: z.number().min(0).default(0),
  oneOffs: z.array(z.object({ year: z.number().int(), amount: z.number() })).default([]),
});
export type SpendingPlan = z.infer<typeof SpendingPlanSchema>;

export const AssumptionsSchema = z.object({
  inflation: z.number().default(0.025),
  discountRate: z.number().default(0.03),
  taxLawMode: z.enum(['current-law', 'tcja-sunset']).default('current-law'),
  indexTablesToInflation: z.boolean().default(true),
});
export type Assumptions = z.infer<typeof AssumptionsSchema>;

export const StrategySchema = z.object({
  rothConversions: z.record(z.string(), z.number()).default({}),
  withdrawalPolicy: WithdrawalPolicySchema.default('conventional'),
  ssClaimAges: z.record(z.string(), z.number()).default({}),
  label: z.string().default('Custom'),
});
export type Strategy = z.infer<typeof StrategySchema>;

export const ScenarioSchema = z.object({
  schemaVersion: z.literal(1),
  startYear: z.number().int(),
  household: HouseholdSchema,
  accounts: z.array(AccountSchema),
  incomeStreams: z.array(IncomeStreamSchema),
  spending: SpendingPlanSchema,
  assumptions: AssumptionsSchema,
  strategy: StrategySchema,
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export type AccountBalance = { accountId: string; balance: number; costBasis?: number };

export type YearResult = {
  year: number;
  primaryAge: number;
  spouseAge?: number;
  wages: number;
  pension: number;
  socialSecurity: number;
  socialSecurityTaxable: number;
  rentalOther: number;
  rmdRequired: number;
  rmdTaken: number;
  rothConversion: number;
  withdrawalsTraditional: number;
  withdrawalsRoth: number;
  withdrawalsTaxable: number;
  taxableCapitalGains: number;
  ordinaryIncome: number;
  ltcgIncome: number;
  agi: number;
  magiIrmaa: number;
  magiNiit: number;
  taxableIncome: number;
  federalTax: number;
  stateTax: number;
  niitTax: number;
  irmaaAnnual: number;
  totalTax: number;
  spendingNeed: number;
  cashShortfall: number;
  balancesEoy: AccountBalance[];
  netWorthEoy: number;
};

export type StrategyResult = {
  strategy: Strategy;
  results: YearResult[];
  score: number;
  lifetimeAfterTax: number;
  lifetimeTax: number;
  endingNetWorth: number;
  anyShortfall: boolean;
  pros: string[];
  cons: string[];
};

export const CURRENT_SCHEMA_VERSION = 1 as const;
