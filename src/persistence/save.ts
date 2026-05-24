import { Scenario, ScenarioSchema } from '../types';
import { migrateScenario } from './migrate';

export type LoadResult = { scenario: Scenario; migrations: string[] };

export function downloadScenarioJson(scenario: Scenario): void {
  const json = JSON.stringify(scenario, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `retirement-plan-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function pickAndLoadScenarioJson(): Promise<LoadResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        // Run schema migrations BEFORE validation — older versions need to be transformed first.
        const { migrated, changes } = migrateScenario(parsed);
        const validated = ScenarioSchema.safeParse(migrated);
        if (!validated.success) {
          reject(new Error(`Invalid scenario file: ${validated.error.issues.map((i) => i.message).join(', ')}`));
          return;
        }
        resolve({ scenario: validated.data, migrations: changes });
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
