import {
  AccountBalance,
  FilingStatus,
  Scenario,
  YearResult,
} from '../types';
import { computeFederalTax, standardDeduction } from './tax/federal';
import { computeSocialSecurityTaxable, ssClaimAgeMultiplier } from './tax/ss';
import { computeIrmaaTier } from './tax/irmaa';
import { computeNiit } from './tax/niit';
import { computeStateTax } from './tax/state';
import { computeRmd } from './rmd';
import {
  AccountState,
  applyGrowth,
  buildWithdrawalOrder,
  convertTraditionalToRoth,
  initAccountState,
  isRoth,
  isTraditional,
  withdrawFromAccounts,
} from './accounts';
import { heirNetValue } from './heir';

type StatusKey = 'single' | 'mfj';

function statusKey(s: FilingStatus): StatusKey {
  return s;
}

/**
 * Deterministic year-by-year simulation. Produces one YearResult per plan year.
 */
export function runScenario(scenario: Scenario): YearResult[] {
  const { startYear, household, accounts, incomeStreams, spending, assumptions, strategy } = scenario;
  const status = statusKey(household.filingStatus);

  const accountStates: AccountState[] = accounts.map(initAccountState);

  const results: YearResult[] = [];
  // IRMAA uses Y-2 MAGI. Keep a ring of the past two years' MAGI.
  const magiHistory: number[] = [];

  const endYear = startYear + (household.planEndAge - (startYear - household.primary.birthYear));

  for (let year = startYear; year <= endYear; year++) {
    const yearsElapsed = year - startYear;
    const primaryAge = year - household.primary.birthYear;
    const spouseAge = household.spouse ? year - household.spouse.birthYear : undefined;
    if (primaryAge > household.planEndAge) break;

    const inflationFactor = Math.pow(1 + assumptions.inflation, yearsElapsed);

    // --- Income streams ---
    let wages = 0;
    let pensionTaxable = 0;
    let rentalOther = 0;
    for (const is of incomeStreams) {
      if (year < is.startYear) continue;
      if (is.endYear != null && year > is.endYear) continue;
      const colaFactor = Math.pow(1 + is.cola, year - is.startYear);
      const amount = is.annualAmount * colaFactor;
      if (is.kind === 'salary') {
        wages += amount;
      } else if (is.kind === 'pension') {
        pensionTaxable += amount * is.taxablePercent;
      } else {
        rentalOther += amount;
      }
    }

    // --- Social Security (per spouse) ---
    const ssPrimary = ssBenefitThisYear(household.primary.ssBenefitAt67, household.primary.ssClaimAge, primaryAge);
    const ssSpouse = household.spouse
      ? ssBenefitThisYear(household.spouse.ssBenefitAt67, household.spouse.ssClaimAge, spouseAge!)
      : 0;
    const ssGross = ssPrimary + ssSpouse;

    // --- RMDs (required this year) ---
    let rmdRequired = 0;
    // Compute per traditional account using owner age and prior-year-end balance (= current balance before growth this year).
    for (const acc of accountStates) {
      if (!isTraditional(acc.type)) continue;
      const owner = acc.ownerId === household.primary.id ? household.primary : household.spouse;
      if (!owner) continue;
      const ownerAge = year - owner.birthYear;
      rmdRequired += computeRmd({
        priorYearEndBalance: acc.balance,
        ownerAge,
        ownerBirthYear: owner.birthYear,
      });
    }

    // --- Strategy: Roth conversion this year (pro-rata per IRC §72 if basis exists) ---
    const plannedConversion = strategy.rothConversions[String(year)] ?? 0;
    const convResult = plannedConversion > 0
      ? convertTraditionalToRoth(accountStates, household.primary.id, plannedConversion)
      : { converted: 0, taxable: 0, basisTransferred: 0 };
    const rothConversion = convResult.converted;
    const rothConversionTaxable = convResult.taxable;

    // --- Force RMD withdrawal (goes out as taxable distribution) ---
    const traditionalAccs = accountStates.filter((a) => isTraditional(a.type));
    const rmdTaken = withdrawFromAccounts(accountStates, traditionalAccs, rmdRequired);

    // --- Spending target (inflation-adjusted) ---
    const baseSpending = spending.baseAnnual * inflationFactor;
    const oneOffs = spending.oneOffs
      .filter((o) => o.year === year)
      .reduce((s, o) => s + o.amount, 0);
    const healthcarePre65 =
      primaryAge < 65 ? spending.healthcarePre65Annual * inflationFactor : 0;

    // --- Iterative tax/withdrawal solve ---
    // Cash already in hand: wages (net of est payroll tax? we ignore), pension, SS gross, rental, RMDs withdrawn.
    // We owe: spending + federal + state + niit + irmaa + conversion tax.
    // Withdrawals to cover the gap come from taxable -> traditional -> roth by default; strategy may change this.
    const incomeCashInHand = wages + pensionTaxable + ssGross + rentalOther + rmdTaken.withdrawn;

    const iterations = 3;
    let extraOrdinaryTaxable = rothConversionTaxable; // only the pre-tax portion of the conversion is taxable
    let extraLtcgTaxable = 0;
    let extraWithdrawalCash = 0;
    let federalTax = 0;
    let stateTax = 0;
    let niitTax = 0;
    let irmaaAnnual = 0;
    let ssTaxable = 0;
    let agi = 0;
    let magiIrmaa = 0;
    let magiNiit = 0;
    let taxableIncome = 0;
    let ordinaryIncome = 0;
    let ltcgIncome = 0;
    let withdrawalsTraditional = 0;
    let withdrawalsRoth = 0;
    let withdrawalsTaxable = 0;
    let taxableCapitalGains = 0;

    // Snapshot balances before withdrawal iteration so we can re-run each pass.
    const snapshot = accountStates.map((a) => ({ ...a }));

    for (let iter = 0; iter < iterations; iter++) {
      // Reset balances to snapshot each iteration
      accountStates.forEach((a, i) => {
        a.balance = snapshot[i].balance;
        a.costBasis = snapshot[i].costBasis;
      });
      withdrawalsTraditional = 0;
      withdrawalsRoth = 0;
      withdrawalsTaxable = 0;
      taxableCapitalGains = 0;
      extraLtcgTaxable = 0;
      extraOrdinaryTaxable = rothConversionTaxable;

      // Previous-iter tax estimate (0 on first pass)
      const taxEstimate = iter === 0 ? 0 : federalTax + stateTax + niitTax + irmaaAnnual;
      const targetGap = Math.max(
        0,
        baseSpending + oneOffs + healthcarePre65 + taxEstimate - incomeCashInHand,
      );

      // Withdraw extra from accounts using the policy.
      const order = buildWithdrawalOrder(accountStates, strategy.withdrawalPolicy);
      const withdrawal = withdrawFromAccounts(accountStates, order, targetGap);
      extraWithdrawalCash = withdrawal.withdrawn;
      let withdrawalsTraditionalTaxable = 0;
      for (const p of withdrawal.perAccount) {
        const acc = accountStates.find((a) => a.id === p.id)!;
        if (isTraditional(acc.type) || acc.type === 'hsa') {
          withdrawalsTraditional += p.amount;
          withdrawalsTraditionalTaxable += p.ordinaryTaxable;
        } else if (isRoth(acc.type)) {
          withdrawalsRoth += p.amount;
        } else if (acc.type === 'taxable') {
          withdrawalsTaxable += p.amount;
          taxableCapitalGains += p.ltcgTaxable;
        }
      }
      // Only the taxable (non-basis) portion of traditional withdrawals counts as income.
      extraOrdinaryTaxable += withdrawalsTraditionalTaxable;
      extraLtcgTaxable += taxableCapitalGains;

      // --- Compute SS taxability ---
      // RMD taxability follows pro-rata on the source account; use ordinaryTaxable not gross.
      const preTaxOrdinary =
        wages + pensionTaxable + rentalOther + rmdTaken.ordinaryTaxable + extraOrdinaryTaxable;
      ssTaxable = computeSocialSecurityTaxable({
        status,
        ssBenefits: ssGross,
        otherOrdinaryIncome: preTaxOrdinary,
        ltcgAndQualifiedDivs: extraLtcgTaxable,
      });

      ordinaryIncome = preTaxOrdinary + ssTaxable;
      ltcgIncome = extraLtcgTaxable;
      agi = ordinaryIncome + ltcgIncome;

      magiIrmaa = agi; // simplification: no tax-exempt interest tracked
      magiNiit = agi;

      const sd = standardDeduction(status, primaryAge, spouseAge);
      const fed = computeFederalTax({
        status,
        ordinaryIncome,
        ltcgIncome,
        standardDeduction: sd,
      });
      taxableIncome = fed.totalTaxableIncome;
      federalTax = fed.totalTax;

      const state = computeStateTax({
        stateCode: household.primary.state,
        status,
        wages,
        pension: pensionTaxable,
        rentalOther,
        socialSecurityGross: ssGross,
        // State tax follows federal on what's taxable from traditional accounts -
        // pass only the pre-tax (non-basis) portion.
        retirementDistributions: rmdTaken.ordinaryTaxable + rothConversionTaxable + withdrawalsTraditionalTaxable,
        taxableCapitalGains: extraLtcgTaxable,
        interestAndDividends: 0,
        primaryAge,
      });
      stateTax = state.tax;

      niitTax = computeNiit({
        status,
        magi: magiNiit,
        netInvestmentIncome: extraLtcgTaxable + rentalOther,
      });

      // --- IRMAA from Y-2 MAGI (per Medicare-eligible adult) ---
      let medicareAdults = 0;
      if (primaryAge >= 65) medicareAdults++;
      if (spouseAge != null && spouseAge >= 65) medicareAdults++;
      if (medicareAdults > 0 && magiHistory.length >= 2) {
        const lookback = magiHistory[magiHistory.length - 2];
        const irmaa = computeIrmaaTier(lookback, status);
        irmaaAnnual = irmaa.annualPerPerson * medicareAdults;
      } else {
        irmaaAnnual = 0;
      }
    }

    // --- After solve: grow remaining balances for the year ---
    for (const acc of accountStates) {
      applyGrowth(acc);
    }

    const totalTax = federalTax + stateTax + niitTax + irmaaAnnual;
    const spendingNeed = baseSpending + oneOffs + healthcarePre65;
    const cashDelivered = incomeCashInHand + extraWithdrawalCash - totalTax;
    const cashShortfall = Math.max(0, spendingNeed - cashDelivered);

    const balancesEoy: AccountBalance[] = accountStates.map((a) => ({
      accountId: a.id,
      balance: a.balance,
      costBasis: a.type === 'taxable' ? a.costBasis : undefined,
    }));
    const netWorthEoy = accountStates.reduce((s, a) => s + a.balance, 0);
    const heirNetWorthEoy = heirNetValue(accountStates, assumptions.heirMarginalTaxRate);

    results.push({
      year,
      primaryAge,
      spouseAge,
      wages,
      pension: pensionTaxable,
      socialSecurity: ssGross,
      socialSecurityTaxable: ssTaxable,
      rentalOther,
      rmdRequired,
      rmdTaken: rmdTaken.withdrawn,
      rothConversion,
      withdrawalsTraditional,
      withdrawalsRoth,
      withdrawalsTaxable,
      taxableCapitalGains,
      ordinaryIncome,
      ltcgIncome,
      agi,
      magiIrmaa,
      magiNiit,
      taxableIncome,
      federalTax,
      stateTax,
      niitTax,
      irmaaAnnual,
      totalTax,
      spendingNeed,
      cashShortfall,
      balancesEoy,
      netWorthEoy,
      heirNetWorthEoy,
    });

    magiHistory.push(magiIrmaa);
  }

  return results;
}

function ssBenefitThisYear(benefitAt67: number, claimAge: number, currentAge: number): number {
  if (currentAge < claimAge) return 0;
  return benefitAt67 * ssClaimAgeMultiplier(claimAge);
}
