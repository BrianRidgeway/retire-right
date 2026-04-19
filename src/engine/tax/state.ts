import { STATES, StatusKey, Bracket } from '../tables';
import { taxFromBrackets } from './federal';

export type StateTaxInput = {
  stateCode: string;
  status: StatusKey;
  wages: number;
  pension: number;
  rentalOther: number;
  socialSecurityGross: number;
  retirementDistributions: number; // traditional IRA/401k withdrawals + Roth conversions
  taxableCapitalGains: number;
  interestAndDividends: number;
  primaryAgeAtLeast595: boolean;
};

export type StateTaxOutput = {
  stateCode: string;
  taxableIncome: number;
  tax: number;
};

/**
 * Simplified state income tax.
 *
 * Starts from a state-taxable base: wages + pension + rental/other + (retirement distributions
 * if the state taxes them) + capital gains + interest/dividends. SS is excluded for the states
 * in this module. PA excludes retirement distributions for age 59.5+. NY applies a pension
 * exemption capped at $20,000 of retirement distributions for age 59.5+.
 *
 * Unknown states fall back to 0. Users can add states by extending states-2025.json.
 */
export function computeStateTax(input: StateTaxInput): StateTaxOutput {
  const cfg = STATES.states[input.stateCode];
  if (!cfg || !cfg.hasIncomeTax) {
    return { stateCode: input.stateCode, taxableIncome: 0, tax: 0 };
  }

  const {
    wages,
    pension,
    rentalOther,
    retirementDistributions,
    taxableCapitalGains,
    interestAndDividends,
    primaryAgeAtLeast595,
    status,
  } = input;

  let retirementIncluded = cfg.taxesRetirementDistributions ? retirementDistributions : 0;

  if (cfg.pensionExemption > 0 && primaryAgeAtLeast595) {
    retirementIncluded = Math.max(0, retirementIncluded - cfg.pensionExemption);
  }

  if (input.stateCode === 'PA' && primaryAgeAtLeast595) {
    retirementIncluded = 0;
  }

  const gross =
    wages +
    pension +
    rentalOther +
    retirementIncluded +
    taxableCapitalGains +
    interestAndDividends;

  const sd = cfg.standardDeduction[status] ?? 0;
  const taxableIncome = Math.max(0, gross - sd);

  let tax = 0;
  if (cfg.flatRate != null) {
    tax = taxableIncome * cfg.flatRate;
  } else if (cfg.brackets) {
    const brackets = cfg.brackets[status] as Bracket[];
    tax = taxFromBrackets(taxableIncome, brackets);
  }

  return { stateCode: input.stateCode, taxableIncome, tax };
}

export function supportedStates(): string[] {
  return Object.keys(STATES.states).sort();
}
