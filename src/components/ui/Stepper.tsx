'use client';

export interface StepDef {
  key: string;
  label: string;
  /** Count badge shown on steps that aren't the active one (e.g. field count). */
  count?: number;
}

interface StepperProps {
  steps: StepDef[];
  activeKey: string;
  /** Steps at or before this index are considered complete (get a checkmark once passed). */
  completedKeys: string[];
}

/**
 * Horizontal step indicator — pill for the active step, plain circle badge
 * for the rest, connected by a line. Purely presentational; step navigation
 * logic (validation, which step is active) lives in the page that uses it.
 */
export default function Stepper({ steps, activeKey, completedKeys }: StepperProps) {
  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const isActive = step.key === activeKey;
        const isComplete = completedKeys.includes(step.key);
        return (
          <div key={step.key} className="flex items-center" style={{ flex: i < steps.length - 1 ? 1 : undefined }}>
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition"
              style={
                isActive
                  ? { backgroundColor: 'var(--accent)', color: '#ffffff' }
                  : isComplete
                  ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }
                  : { backgroundColor: 'var(--surface-muted)', color: 'var(--foreground-muted)' }
              }
            >
              <span>{step.label}</span>
              {isComplete && !isActive ? (
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
                  style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
                  aria-hidden
                >
                  ✓
                </span>
              ) : step.count !== undefined ? (
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
                  style={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface)',
                    color: isActive ? '#ffffff' : 'var(--foreground-muted)',
                  }}
                  aria-hidden
                >
                  {step.count}
                </span>
              ) : null}
            </div>
            {i < steps.length - 1 && (
              <div className="mx-2 h-px flex-1" style={{ backgroundColor: 'var(--border)' }} aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
