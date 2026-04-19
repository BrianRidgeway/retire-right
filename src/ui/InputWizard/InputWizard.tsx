import { useState } from 'react';
import { HouseholdStep } from './HouseholdStep';
import { AccountsStep } from './AccountsStep';
import { IncomeStep } from './IncomeStep';
import { SpendingStep } from './SpendingStep';
import { AssumptionsStep } from './AssumptionsStep';

const STEPS = ['Household', 'Accounts', 'Income', 'Spending', 'Assumptions'] as const;

export function InputWizard() {
  const [step, setStep] = useState(0);

  return (
    <div>
      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <button
            key={s}
            className={`wizard-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            onClick={() => setStep(i)}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>
      {step === 0 && <HouseholdStep />}
      {step === 1 && <AccountsStep />}
      {step === 2 && <IncomeStep />}
      {step === 3 && <SpendingStep />}
      {step === 4 && <AssumptionsStep />}
      <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          ← Back
        </button>
        <button
          className="primary"
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={step === STEPS.length - 1}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
