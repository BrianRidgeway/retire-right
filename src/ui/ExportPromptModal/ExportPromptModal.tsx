import { useMemo, useState } from 'react';
import { useScenarioStore } from '../../state/scenarioStore';
import { buildAiPrompt } from '../../persistence/aiPrompt';

export function ExportPromptModal({ onClose }: { onClose: () => void }) {
  const scenario = useScenarioStore((s) => s.scenario);
  const optimizerResults = useScenarioStore((s) => s.optimizerResults);

  const prompt = useMemo(
    () => buildAiPrompt(scenario, optimizerResults ?? []),
    [scenario, optimizerResults],
  );
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const el = document.getElementById('ai-prompt-ta') as HTMLTextAreaElement | null;
      el?.select();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>AI consultation prompt</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="warning">
          Pasting this into a third-party AI (ChatGPT, Claude, Gemini, etc.) sends your scenario data to that
          provider. Review before sending - remove anything you wouldn't want stored.
          {optimizerResults == null && (
            <>
              {' '}
              <strong>Tip:</strong> run the optimizer first (Strategies tab) so the prompt includes strategy
              comparisons.
            </>
          )}
        </div>
        <textarea id="ai-prompt-ta" value={prompt} readOnly />
        <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={copy} className="primary">
            {copied ? 'Copied ✓' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
