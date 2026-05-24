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
  annualTaxableYield,
  applyGrowth,
  convertTraditionalToRoth,
  executeWithdrawal,
  initAccountState,
  isRoth,
  isTraditional,
  withdrawFromAccounts,
} from './accounts';
import { heirNetValue, effectiveHeirRate } from './heir';
import { federalTableForYear } from './tables';

type StatusKey = 'single' | 'mfj';

function statusKey(s: FilingStatus): StatusKey {
  return s;
}

/**
 * Deterministic year-by-year simulation. Produces one YearResult per plan year.
 * When `scenario.survivorEvent` is set, the projection switches to single-filer math
 * starting the year AFTER the decedent dies: accounts roll over to the survivor, SS
 * collapses to the larger benefit, and pensions apply their survivorPct.
 */
export function runScenario(scenario: Scenario): YearResult[] {
  const { startYear, accounts, incomeStreams, spending, assumptions, strategy, survivorEvent } = scenario;

  const accountStates: AccountState[] = accounts.map(initAccountState);

  const results: YearResult[] = [];
  // IRMAA uses Y-2 MAGI. Keep a ring of the past two years' MAGI.
  const magiHistory: number[] = [];

  // Resolve identifiers for survivor logic
  const decedentId = survivorEvent?.decedentId;
  const survivorId = survivorEvent
    ? scenario.household.primary.id === decedentId
      ? scenario.household.spouse?.id
      : scenario.household.primary.id
    : undefined;

  const endYear = startYear + (scenario.household.planEndAge - (startYear - scenario.household.primary.birthYear));

  for (let year = startYear; year <= endYear; year++) {
    // Each iteration recomputes the effective household for this year — once the decedent
    // has died, the household collapses to single with only the survivor.
    const isPostDeath = survivorEvent != null && year > survivorEvent.year;
    const household = isPostDeath
      ? {
          ...scenario.household,
          filingStatus: 'single' as const,
          primary:
            scenario.household.primary.id === survivorId
              ? scenario.household.primary
              : scenario.household.spouse!,
          spouse: undefined,
        }
      : scenario.household;
    const status = statusKey(household.filingStatus);
    const yearsElapsed = year - startYear;
    const primaryAge = year - household.primary.birthYear;
    const spouseAge = household.spouse ? year - household.spouse.birthYear : undefined;
    if (primaryAge > household.planEndAge) break;

    // On the first post-death year, transfer decedent's account ownership to survivor
    // (spousal rollover for IRAs/Roth; for taxable inheritance the basis would step up,
    // but we approximate by transferring as-is — heir-net adjustment handles the rest).
    if (isPostDeath && year === survivorEvent!.year + 1 && survivorId && decedentId) {
      for (const acc of accountStates) {
        if (acc.ownerId === decedentId) {
          acc.ownerId = survivorId;
          if (acc.type === 'taxable') {
            // Step-up basis to current balance on inheritance.
            acc.costBasis = acc.balance;
          }
        }
      }
    }

    const inflationFactor = Math.pow(1 + assumptions.inflation, yearsElapsed);

    // --- Income streams ---
    let wages = 0;
    let pensionTaxable = 0;
    let rentalOther = 0;
    for (const is of incomeStreams) {
      if (year < is.startYear) continue;
      if (is.endYear != null && year > is.endYear) continue;
      // After death, pensions owned by the decedent multiply by survivorPct
      const survivorMult =
        isPostDeath && is.kind === 'pension' && is.ownerId === decedentId
          ? is.survivorPct
          : 1;
      if (survivorMult === 0) continue;
      const colaFactor = Math.pow(1 + is.cola, year - is.startYear);
      const amount = is.annualAmount * colaFactor * survivorMult;
      if (is.kind === 'salary') {
        // Salary stops after death for the decedent
        if (isPostDeath && is.ownerId === decedentId) continue;
        wages += amount;
      } else if (is.kind === 'pension') {
        pensionTaxable += amount * is.taxablePercent;
      } else {
        rentalOther += amount;
      }
    }

    // --- Social Security (per spouse) ---
    let ssGross: number;
    if (isPostDeath && survivorEvent && decedentId) {
      // Survivor takes the larger of the two benefits; smaller is lost.
      const decedent = scenario.household.primary.id === decedentId
        ? scenario.household.primary
        : scenario.household.spouse!;
      const survivor = scenario.household.primary.id === decedentId
        ? scenario.household.spouse!
        : scenario.household.primary;
      const decedentAgeAtDeath = survivorEvent.year - decedent.birthYear;
      const survivorBenefit = ssBenefitThisYear(survivor, year - survivor.birthYear);
      const decedentBenefitAtDeath = ssBenefitThisYear(decedent, decedentAgeAtDeath);
      ssGross = Math.max(survivorBenefit, decedentBenefitAtDeath);
    } else {
      const ssPrimary = ssBenefitThisYear(household.primary, primaryAge);
      const ssSpouse = household.spouse
        ? ssBenefitThisYear(household.spouse, spouseAge!)
        : 0;
      ssGross = ssPrimary + ssSpouse;
    }

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

    // --- QCD: route charitable giving through traditional IRA for any spouse age 70.5+ ---
    // QCDs come out of traditional, count toward RMD, and are EXCLUDED from AGI/MAGI. Limit is
    // $108K per person (2025; verify annually). We split giving across eligible spouses pro-rata
    // by traditional balance. The QCD reduces both the traditional balance and the RMD obligation.
    const qcdResult = routeQcd({
      accounts: accountStates,
      year,
      primary: household.primary,
      spouse: household.spouse,
      annualCharitableGiving: spending.annualCharitableGiving,
    });
    const qcdAmount = qcdResult.total;
    // QCDs count toward RMD: reduce remaining RMD requirement by QCD amount before forced withdrawal.
    const rmdAfterQcd = Math.max(0, rmdRequired - qcdAmount);

    // --- Force RMD withdrawal (goes out as taxable distribution) ---
    const traditionalAccs = accountStates.filter((a) => isTraditional(a.type));
    const rmdTaken = withdrawFromAccounts(accountStates, traditionalAccs, rmdAfterQcd);

    // --- Spending target (inflation-adjusted) ---
    const baseSpending = spending.baseAnnual * inflationFactor;
    const oneOffs = spending.oneOffs
      .filter((o) => o.year === year)
      .reduce((s, o) => s + o.amount, 0);
    const healthcarePre65 =
      primaryAge < 65 ? spending.healthcarePre65Annual * inflationFactor : 0;

    // --- IRMAA for this year (Y-2 MAGI, deterministic before the solve) ---
    // We compute IRMAA up-front so HSA can offset it before the iterative cash solve.
    let irmaaAnnualUpfront = 0;
    {
      let medicareAdults = 0;
      if (primaryAge >= 65) medicareAdults++;
      if (spouseAge != null && spouseAge >= 65) medicareAdults++;
      if (medicareAdults > 0 && magiHistory.length >= 2) {
        const lookback = magiHistory[magiHistory.length - 2];
        const irmaa = computeIrmaaTier(lookback, status);
        irmaaAnnualUpfront = irmaa.annualPerPerson * medicareAdults;
      }
    }

    // --- HSA Medicare premium reimbursement (tax-free) ---
    // If the household has HSA balance and someone is on Medicare, drain HSA up to the year's
    // Medicare cost. Reimbursable: Part B + Part D + Medicare Advantage (NOT Medigap, which we
    // don't model). This is tax-free under IRC §223(f)(4)(C).
    let hsaMedicareReimbursement = 0;
    if (irmaaAnnualUpfront > 0) {
      const hsaAccs = accountStates.filter((a) => a.type === 'hsa' && a.balance > 0);
      const totalHsa = hsaAccs.reduce((s, a) => s + a.balance, 0);
      hsaMedicareReimbursement = Math.min(irmaaAnnualUpfront, totalHsa);
      let remaining = hsaMedicareReimbursement;
      for (const acc of hsaAccs) {
        if (remaining <= 0) break;
        const take = Math.min(acc.balance, remaining);
        acc.balance -= take;
        // HSA basis is meaningless for qualified withdrawal (tax-free regardless), but keep it
        // consistent so basis doesn't exceed balance.
        acc.costBasis = Math.max(0, Math.min(acc.costBasis, acc.balance));
        remaining -= take;
      }
    }

    // --- Iterative tax/withdrawal solve ---
    // Cash already in hand: wages (net of est payroll tax? we ignore), pension, SS gross, rental,
    // RMDs withdrawn, plus tax-free HSA reimbursement of Medicare premiums.
    // We owe: spending + federal + state + niit + irmaa + conversion tax.
    // Withdrawals to cover the gap come from taxable -> traditional -> roth by default; strategy may change this.
    const incomeCashInHand =
      wages + pensionTaxable + ssGross + rentalOther + rmdTaken.withdrawn + hsaMedicareReimbursement;

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

      // Withdraw extra from accounts using the policy. Pass current ordinary-income context
      // so bracket-fill can avoid jumping marginal brackets.
      const yearFederal = federalTableForYear(year, assumptions.taxLawMode);
      const sdForBracket = standardDeduction(status, primaryAge, spouseAge, yearFederal);
      const ordinaryIncomeBeforeExtra =
        wages + pensionTaxable + rentalOther + rmdTaken.ordinaryTaxable + rothConversionTaxable;
      const withdrawal = executeWithdrawal(
        accountStates,
        strategy.withdrawalPolicy,
        targetGap,
        {
          status,
          ordinaryIncomeBeforeExtra,
          standardDeduction: sdForBracket,
          federalBrackets: yearFederal.ordinaryBrackets[status],
        },
      );
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

      // --- Annual tax drag on taxable accounts (dividends/interest/REIT distributions) ---
      // Yield is added to AGI; reinvestment is handled by applyGrowth bumping basis.
      let taxDragOrdinary = 0;
      let taxDragQualified = 0;
      for (const acc of accountStates) {
        if (acc.type !== 'taxable') continue;
        const y = annualTaxableYield(acc);
        taxDragOrdinary += y.ordinary;
        taxDragQualified += y.qualifiedDividends;
      }
      extraOrdinaryTaxable += taxDragOrdinary;
      extraLtcgTaxable += taxDragQualified;

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

      const sd = standardDeduction(status, primaryAge, spouseAge, yearFederal);
      const fed = computeFederalTax({
        status,
        ordinaryIncome,
        ltcgIncome,
        standardDeduction: sd,
        tables: yearFederal,
      });
      taxableIncome = fed.totalTaxableIncome;
      federalTax = fed.totalTax;

      const state = computeStateTax({
        stateCode: household.primary.state,
        countyCode: household.primary.countyCode,
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

      // IRMAA was already computed before the iteration loop (deterministic in Y-2 MAGI).
      irmaaAnnual = irmaaAnnualUpfront;
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
    const heirNetWorthEoy = heirNetValue(accountStates, effectiveHeirRate(assumptions));

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
      qcdAmount,
      hsaMedicareReimbursement,
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

const QCD_ANNUAL_LIMIT_PER_PERSON = 108_000; // 2025 limit; indexed annually
const QCD_MIN_AGE = 70.5;

/**
 * Route the household's annual charitable giving as Qualified Charitable Distributions across
 * any spouse age 70.5+ who has a traditional IRA balance. Splits pro-rata by traditional balance
 * across eligible spouses, capped per-person at the QCD limit and per-account at their balance.
 * Mutates the accounts in place (reduces traditional balance by the QCD amount).
 */
function routeQcd(params: {
  accounts: AccountState[];
  year: number;
  primary: { id: string; birthYear: number };
  spouse?: { id: string; birthYear: number };
  annualCharitableGiving: number;
}): { total: number; perPerson: Record<string, number> } {
  const { accounts, year, primary, spouse, annualCharitableGiving } = params;
  const perPerson: Record<string, number> = {};
  if (annualCharitableGiving <= 0) return { total: 0, perPerson };

  const eligible: { id: string; tradBalance: number }[] = [];
  for (const p of [primary, spouse].filter(Boolean) as Array<{ id: string; birthYear: number }>) {
    const age = year - p.birthYear;
    if (age < QCD_MIN_AGE) continue;
    const tradBalance = accounts
      .filter((a) => a.ownerId === p.id && isTraditional(a.type))
      .reduce((s, a) => s + a.balance, 0);
    if (tradBalance <= 0) continue;
    eligible.push({ id: p.id, tradBalance });
  }
  if (eligible.length === 0) return { total: 0, perPerson };

  const totalBalance = eligible.reduce((s, e) => s + e.tradBalance, 0);

  let total = 0;
  for (const e of eligible) {
    // Split giving pro-rata by traditional balance, cap per-person at QCD limit
    const share = (e.tradBalance / totalBalance) * annualCharitableGiving;
    const personQcd = Math.min(share, QCD_ANNUAL_LIMIT_PER_PERSON, e.tradBalance);
    if (personQcd <= 0) continue;
    // Pull from this person's traditional accounts. Use pro-rata basis logic but DON'T
    // create taxable income (QCDs are excluded from AGI). Reduce balance; basis goes with it
    // proportionally (consistent with how the IRS treats QCDs vs basis tracking — they come
    // out pre-tax first, but our simplification treats them pro-rata to balance).
    let remaining = personQcd;
    const tradAccs = accounts.filter((a) => a.ownerId === e.id && isTraditional(a.type) && a.balance > 0);
    for (const acc of tradAccs) {
      if (remaining <= 0) break;
      const take = Math.min(acc.balance, remaining);
      // Reduce basis proportionally so future tax-free basis remains correct.
      if (acc.balance > 0 && acc.costBasis > 0) {
        const basisFrac = Math.min(1, acc.costBasis / acc.balance);
        acc.costBasis = Math.max(0, acc.costBasis - take * basisFrac);
      }
      acc.balance -= take;
      remaining -= take;
    }
    total += personQcd;
    perPerson[e.id] = personQcd;
  }
  return { total, perPerson };
}

function ssBenefitThisYear(
  person: { ssBenefitAtFra: number; ssClaimAge: number; ssAlreadyClaimed: boolean; ssCurrentAnnualBenefit: number; birthYear: number },
  currentAge: number,
): number {
  if (currentAge < person.ssClaimAge) return 0;
  // If the person is already collecting, use the actual benefit they reported.
  // The FRA multiplier is meaningless here — they already know their check.
  if (person.ssAlreadyClaimed) return person.ssCurrentAnnualBenefit;
  return person.ssBenefitAtFra * ssClaimAgeMultiplier(person.ssClaimAge, person.birthYear);
}
