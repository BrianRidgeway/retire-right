import { ReactNode, useState } from 'react';

/**
 * Small "?" icon next to a label. Click opens a modal explaining what belongs in the field.
 * Reuses the global .modal-backdrop / .modal CSS classes. Pass the modal body as children.
 */
export function HelpButton({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="What goes here?"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          marginLeft: 6,
          padding: 0,
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-dim)',
          cursor: 'help',
          verticalAlign: 'middle',
        }}
      >
        ?
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal"
            style={{ maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{title}</h3>
              <button onClick={() => setOpen(false)}>Close</button>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55 }}>{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
