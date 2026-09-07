interface SpinnerProps {
  size?: number;
  stroke?: number;
  label?: string;
}

export default function Spinner({
  size = 40,
  stroke = 4,
  label = "Loading",
}: SpinnerProps) {
  const r = (size - stroke) / 2;

  return (
    <div
      role="status"
      aria-label={label}
      className="inline-flex items-center justify-center"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="spinner-ring"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${r * Math.PI * 0.5} ${r * Math.PI * 1.5}`}
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
