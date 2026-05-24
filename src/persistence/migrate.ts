import { CURRENT_SCHEMA_VERSION } from '../types';

/**
 * Migrate an old-schema-version scenario JSON to the current shape.
 *
 * Returns the migrated object (a deep-ish copy) and a list of human-readable changes that were
 * applied — useful to show the user a "we updated your file from v1 → v2" notice. If the input
 * is already at CURRENT_SCHEMA_VERSION, the object is returned unchanged with an empty change
 * list. If the input lacks a recognized schemaVersion or is otherwise unparseable, the function
 * returns the input as-is and lets downstream Zod validation surface the error.
 *
 * v1 → v2 changes:
 *   - household.{primary,spouse}.ssBenefitAt67  →  ssBenefitAtFra (rename only; semantics
 *     unchanged — both refer to PIA, the benefit at FRA)
 *   - incomeStreams[].survivorPct: 1 (added; defaults to 100% J&S, override per stream)
 *   - spending.annualCharitableGiving: 0 (added; routed as QCD when 70.5+ spouse with traditional IRA)
 *   - assumptions.heirs: [] (added; empty array falls back to assumptions.heirMarginalTaxRate)
 *   - assumptions.taxLawMode default migration: leave existing value; new "obbba" option is
 *     available but we don't auto-flip 'current-law' → 'obbba' since they're not equivalent
 *     (obbba adds a senior bonus deduction that current-law explicitly excludes)
 */
export function migrateScenario(raw: unknown): { migrated: unknown; changes: string[] } {
  if (!raw || typeof raw !== 'object') return { migrated: raw, changes: [] };
  const obj = raw as Record<string, unknown>;
  const version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : undefined;

  if (version === CURRENT_SCHEMA_VERSION) {
    return { migrated: raw, changes: [] };
  }

  const changes: string[] = [];
  let current = obj;

  if (version === 1 || version === undefined) {
    current = migrateV1ToV2(current, changes);
  }

  // Future migrations chain here: if (version === 2) current = migrateV2ToV3(current, changes);

  return { migrated: current, changes };
}

function migrateV1ToV2(obj: Record<string, unknown>, changes: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj, schemaVersion: 2 };

  // 1. Rename ssBenefitAt67 → ssBenefitAtFra on primary and spouse
  const household = obj.household as Record<string, unknown> | undefined;
  if (household && typeof household === 'object') {
    const newHousehold: Record<string, unknown> = { ...household };
    for (const key of ['primary', 'spouse'] as const) {
      const person = household[key] as Record<string, unknown> | undefined;
      if (person && typeof person === 'object' && 'ssBenefitAt67' in person) {
        const { ssBenefitAt67, ...rest } = person;
        newHousehold[key] = { ...rest, ssBenefitAtFra: ssBenefitAt67 };
        changes.push(`Renamed ssBenefitAt67 → ssBenefitAtFra on ${key === 'primary' ? 'primary' : 'spouse'} (the field always meant "benefit at FRA"; the old name was misleading for anyone born before 1960 whose FRA is not 67).`);
      }
    }
    out.household = newHousehold;
  }

  // 2. Add survivorPct: 1 to each income stream that lacks it
  const incomeStreams = obj.incomeStreams as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(incomeStreams)) {
    let touched = 0;
    out.incomeStreams = incomeStreams.map((stream) => {
      if (typeof stream !== 'object' || stream == null) return stream;
      if ('survivorPct' in stream) return stream;
      touched++;
      return { ...stream, survivorPct: 1 };
    });
    if (touched > 0) {
      changes.push(`Set survivorPct=1.0 (100% J&S) on ${touched} income stream${touched === 1 ? '' : 's'}. Update per-stream if your real pension election is 50% or 75% — only the survivor scenario uses this.`);
    }
  }

  // 3. Add annualCharitableGiving: 0 to spending
  const spending = obj.spending as Record<string, unknown> | undefined;
  if (spending && typeof spending === 'object' && !('annualCharitableGiving' in spending)) {
    out.spending = { ...spending, annualCharitableGiving: 0 };
    changes.push(`Added spending.annualCharitableGiving=0. Set it on the Spending step if you want QCD routing for spouses 70.5+ with traditional IRAs.`);
  }

  // 4. Add heirs: [] to assumptions
  const assumptions = obj.assumptions as Record<string, unknown> | undefined;
  if (assumptions && typeof assumptions === 'object' && !('heirs' in assumptions)) {
    out.assumptions = { ...assumptions, heirs: [] };
    changes.push(`Added assumptions.heirs=[] (empty — falls back to assumptions.heirMarginalTaxRate). Add per-heir entries on the Assumptions step if you want share-weighted rates.`);
  }

  return out;
}
