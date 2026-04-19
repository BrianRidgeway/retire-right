import federal2025 from '../tables/federal-2025.json';
import irmaa2025 from '../tables/irmaa-2025.json';
import rmdTable from '../tables/rmd-divisors.json';
import states2025 from '../tables/states-2025.json';

export type Bracket = { rate: number; min: number; max: number | null };
export type StatusKey = 'single' | 'mfj';

export type FederalTables = {
  taxYear: number;
  ordinaryBrackets: Record<StatusKey, Bracket[]>;
  ltcgBrackets: Record<StatusKey, Bracket[]>;
  standardDeduction: {
    single: number;
    mfj: number;
    age65Extra: { single: number; mfj: number };
  };
  ssTaxability: Record<StatusKey, { tier1: number; tier2: number }>;
  niit: { rate: number; threshold: { single: number; mfj: number } };
};

export type IrmaaTier = { magiMax: number | null; partBPremium: number; partDSurcharge: number };
export type IrmaaTables = {
  taxYear: number;
  partBBase: number;
  tiers: Record<StatusKey, IrmaaTier[]>;
};

export type RmdTables = {
  uniformLifetime: Record<string, number>;
  applicableAge: {
    bornBefore1951: number;
    born1951to1959: number;
    born1960orLater: number;
  };
};

export type StateTables = {
  states: Record<string, StateTaxConfig>;
};

export type StateTaxConfig =
  | { hasIncomeTax: false }
  | {
      hasIncomeTax: true;
      taxesSocialSecurity: boolean;
      taxesRetirementDistributions: boolean;
      /** Dollar cap on retirement-income exclusion for qualifying ages. */
      pensionExemption: number;
      /** Minimum age for the pension exemption to apply. Defaults to 59.5 if omitted. MD uses 65. */
      pensionExemptionMinAge?: number;
      brackets?: Record<StatusKey, Bracket[]>;
      flatRate?: number;
      standardDeduction: { single: number; mfj: number };
      /** Flat local (county/city) rate added to the state-level tax. Defaults to 0. MD counties ~3%. */
      localSurcharge?: number;
    };

export const FEDERAL: FederalTables = federal2025 as FederalTables;
export const IRMAA: IrmaaTables = irmaa2025 as IrmaaTables;
export const RMD: RmdTables = rmdTable as RmdTables;
export const STATES: StateTables = states2025 as StateTables;
