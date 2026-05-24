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
  'preserve-for-step-up',
] as const;
export const WithdrawalPolicySchema = z.enum(WITHDRAWAL_POLICIES);
export type WithdrawalPolicy = z.infer<typeof WithdrawalPolicySchema>;

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  birthYear: z.number().int().min(1900).max(2100),
  state: z.string().length(2),
  /**
   * Optional county/local jurisdiction code. Used by states with local income tax
   * (Maryland counties + Baltimore City). Examples: "MD-MONT" (Montgomery), "MD-HOW"
   * (Howard), "MD-BALT-CITY" (Baltimore City). When unset for an MD resident, the
   * statewide average ~3% is used.
   */
  countyCode: z.string().optional(),
  ssBenefitAtFra: z.number().min(0),
  ssClaimAge: z.number().min(62).max(70),
  ssAlreadyClaimed: z.boolean().default(false),
  ssCurrentAnnualBenefit: z.number().min(0).default(0),
});
export type Person = z.infer<typeof PersonSchema>;

export const HouseholdSchema = z.object({
  filingStatus: FilingStatusSchema,
  primary: PersonSchema,
  spouse: PersonSchema.optional(),
  planEndAge: z.number().int().min(70).max(110),
});
export type Household = z.infer<typeof HouseholdSchema>;

/**
 * Asset mix for an account (fractions, should sum to 1.0). Drives tax drag computation
 * on taxable accounts and the rebalance suggestion in asset-location analysis.
 */
export const AssetMixSchema = z.object({
  equitiesPct: z.number().min(0).max(1).default(1),
  bondsPct: z.number().min(0).max(1).default(0),
  reitsPct: z.number().min(0).max(1).default(0),
});
export type AssetMix = z.infer<typeof AssetMixSchema>;

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
  /**
   * Optional asset mix. When set on a taxable account, drives annual tax drag
   * (bond interest + REIT distributions as ordinary income; equity dividends as qualified).
   * Defaults to 100% equities.
   */
  assetMix: AssetMixSchema.optional(),
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
  /**
   * Survivor benefit fraction (0..1) applied to pension after the owner dies.
   * Common pension elections: 1.0 (100% joint & survivor), 0.75, 0.5, 0 (single life).
   * Only used in the survivor-scenario projection; defaults to 1.0 (assume 100% J&S) for safety.
   */
  survivorPct: z.number().min(0).max(1).default(1),
});
export type IncomeStream = z.infer<typeof IncomeStreamSchema>;

export const SpendingPlanSchema = z.object({
  baseAnnual: z.number().min(0),
  inflation: z.number().default(0.025),
  healthcarePre65Annual: z.number().min(0).default(0),
  oneOffs: z.array(z.object({ year: z.number().int(), amount: z.number() })).default([]),
  /**
   * Annual charitable giving (today's dollars). For any spouse age 70.5+ with traditional IRA
   * balance, this is automatically routed as a Qualified Charitable Distribution: comes out of
   * the traditional IRA, counts toward RMD, and is NOT included in AGI/MAGI (so it avoids
   * IRMAA, SS taxation, and NIIT). Capped at $108K per person (2025 limit, indexed annually).
   * Set to 0 to skip QCD modeling entirely.
   */
  annualCharitableGiving: z.number().min(0).default(0),
});
export type SpendingPlan = z.infer<typeof SpendingPlanSchema>;

export const HeirSchema = z.object({
  name: z.string(),
  /** Heir's combined federal + state marginal rate on inherited traditional distributions. */
  marginalRatePct: z.number().min(0).max(0.6),
  /** Fraction of the estate this heir receives (0..1). All heirs' shares should sum to 1.0. */
  sharePct: z.number().min(0).max(1),
});
export type Heir = z.infer<typeof HeirSchema>;

export const AssumptionsSchema = z.object({
  inflation: z.number().default(0.025),
  discountRate: z.number().default(0.03),
  taxLawMode: z.enum(['current-law', 'tcja-sunset', 'obbba']).default('obbba'),
  indexTablesToInflation: z.boolean().default(true),
  /**
   * Effective marginal federal+state rate heirs would pay on inherited traditional IRA/401(k)
   * distributions under the SECURE Act 10-year rule. Default 0.32 assumes a mid-career professional
   * beneficiary; set to 0 to score ending wealth at face value. Ignored if `heirs` is non-empty.
   */
  heirMarginalTaxRate: z.number().min(0).max(0.6).default(0.32),
  /**
   * Optional per-heir breakdown. When set, the effective heir rate is the share-weighted average
   * across all heirs and `heirMarginalTaxRate` is ignored.
   */
  heirs: z.array(HeirSchema).default([]),
});
export type Assumptions = z.infer<typeof AssumptionsSchema>;

export const StrategySchema = z.object({
  rothConversions: z.record(z.string(), z.number()).default({}),
  withdrawalPolicy: WithdrawalPolicySchema.default('conventional'),
  ssClaimAges: z.record(z.string(), z.number()).default({}),
  label: z.string().default('Custom'),
});
export type Strategy = z.infer<typeof StrategySchema>;

export const SurvivorEventSchema = z.object({
  /** Calendar year in which the decedent dies (last year of joint filing). */
  year: z.number().int(),
  /** Person id of the decedent (the survivor inherits accounts, SS, and pension residuals). */
  decedentId: z.string(),
});
export type SurvivorEvent = z.infer<typeof SurvivorEventSchema>;

export const CURRENT_SCHEMA_VERSION = 2 as const;

export const ScenarioSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  startYear: z.number().int(),
  household: HouseholdSchema,
  accounts: z.array(AccountSchema),
  incomeStreams: z.array(IncomeStreamSchema),
  spending: SpendingPlanSchema,
  assumptions: AssumptionsSchema,
  strategy: StrategySchema,
  /**
   * Optional survivor event. When set, the projection switches to single-filer math after this
   * year: the survivor inherits decedent's accounts (spousal rollover), takes the larger of the
   * two SS benefits, and pensions are multiplied by their survivorPct.
   */
  survivorEvent: SurvivorEventSchema.optional(),
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
  /** Qualified Charitable Distribution routed out of traditional IRA (counts toward RMD, excluded from AGI). */
  qcdAmount: number;
  /** Tax-free HSA withdrawal used to reimburse Medicare premiums (Part B + Part D surcharge). */
  hsaMedicareReimbursement: number;
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
  /**
   * Ending net worth adjusted for the taxes heirs would owe on inherited assets:
   *   - traditional IRA/401(k)/HSA: taxable portion (balance − basis) × heir marginal rate is subtracted
   *   - Roth: passes tax-free (no adjustment)
   *   - taxable brokerage: stepped-up basis on inheritance wipes unrealized gains (no adjustment)
   */
  heirNetWorthEoy: number;
};

export type StrategyResult = {
  strategy: Strategy;
  results: YearResult[];
  score: number;
  lifetimeAfterTax: number;
  lifetimeTax: number;
  endingNetWorth: number;
  /** After-heir-tax ending net worth: what your heirs actually get to keep. */
  endingHeirNetWorth: number;
  /**
   * Sensitivity of after-heir-tax ending wealth to the heir marginal rate. Keys are rate-percent
   * strings ("22", "24", "32", "35"); values are dollar ending-wealth-after-heir-tax.
   */
  heirSensitivity: { rate: number; endingHeirNetWorth: number }[];
  /** Same metrics computed under a survivor scenario (older spouse dies at age 85 by default). */
  survivor?: {
    deathYear: number;
    decedentName: string;
    lifetimeTax: number;
    endingNetWorth: number;
    endingHeirNetWorth: number;
    anyShortfall: boolean;
  };
  /**
   * Long-term-care stress scenario: one spouse needs 3 years of paid care starting at age 80,
   * default cost $140K/yr indexed at 5% medical inflation. Reports the ending wealth impact and
   * whether the plan fails (cash shortfall) under the stress when it doesn't under the base case.
   */
  ltcStress?: {
    startYear: number;
    totalCostNominal: number;
    endingNetWorth: number;
    endingHeirNetWorth: number;
    anyShortfall: boolean;
    /** True when the base case had no shortfall but the LTC stress does — the failure mode the user cares about. */
    stressInducedShortfall: boolean;
  };
  anyShortfall: boolean;
  /** Plain-English actions the user would take to implement this strategy. */
  actions: string[];
  /** Why this strategy is proposed - the economic logic behind it. */
  rationale: string;
  pros: string[];
  cons: string[];
  /**
   * Specific flags about THIS strategy or the input scenario that a human reviewer should know about
   * before acting on it. Examples: single-year conversion exceeds top IRMAA tier, withdrawal order
   * forfeits step-up basis, SS claim age in the past, pension survivor election unspecified.
   */
  concerns: string[];
};
