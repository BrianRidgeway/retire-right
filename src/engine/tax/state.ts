import { STATES, StatusKey, Bracket } from '../tables';
import { taxFromBrackets } from './federal';

export type StateTaxInput = {
  stateCode: string;
  status: StatusKey;
  primaryAge: number;
  wages: number;
  pension: number;
  rentalOther: number;
  socialSecurityGross: number;
  retirementDistributions: number; // traditional IRA/401k withdrawals + Roth conversions (taxable portion)
  taxableCapitalGains: number;
  interestAndDividends: number;
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
 * if the state taxes them) + capital gains + interest/dividends. SS is excluded for all states
 * in this module. State-specific rules:
 *   - PA: retirement distributions fully exempt for age 59.5+.
 *   - NY: up to $20,000 pension exclusion for age 59.5+.
 *   - MD: up to ~$39,500 (2025) pension exclusion for age 65+, plus a flat county local tax
 *     that sits on top of state brackets (~3.0% average, roughly 2.25%-3.2% by county).
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
    primaryAge,
    status,
  } = input;

  let retirementIncluded = cfg.taxesRetirementDistributions ? retirementDistributions : 0;

  const exemptionAge = cfg.pensionExemptionMinAge ?? 59.5;
  if (cfg.pensionExemption > 0 && primaryAge >= exemptionAge) {
    retirementIncluded = Math.max(0, retirementIncluded - cfg.pensionExemption);
  }

  if (input.stateCode === 'PA' && primaryAge >= 59.5) {
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

  let stateTax = 0;
  if (cfg.flatRate != null) {
    stateTax = taxableIncome * cfg.flatRate;
  } else if (cfg.brackets) {
    const brackets = cfg.brackets[status] as Bracket[];
    stateTax = taxFromBrackets(taxableIncome, brackets);
  }

  // Local (county/city) surcharge - flat rate on the state-taxable base. MD uses this for
  // county income tax; most others are 0.
  const localSurcharge = cfg.localSurcharge ?? 0;
  const localTax = taxableIncome * localSurcharge;

  return { stateCode: input.stateCode, taxableIncome, tax: stateTax + localTax };
}

export function supportedStates(): string[] {
  return Object.keys(STATES.states).sort();
}
