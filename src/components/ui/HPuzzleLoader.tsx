interface HPuzzleLoaderProps {
  size?: number;
  className?: string;
}

/** Suki mark chevrons that read as the loader “H”. */
const LEFT_PATH = "M140.132 0L0 172.743V535L217 267.5H140.132V0Z";
const RIGHT_PATH = "M293.868 535L434 362.257V0L217 267.5H293.868V535Z";
const VIEW = "0 0 434 535";
const RATIO = 434 / 535;

/**
 * Two-piece Suki H-mark. Pieces slide in, lock, then pull apart.
 */
export function HPuzzleLoader({ size = 160, className = "" }: HPuzzleLoaderProps) {
  return (
    <div
      className={`h-puzzle ${className}`.trim()}
      style={{ width: size * RATIO, height: size }}
      role="status"
      aria-label="Loading"
    >
      <div className="h-puzzle-piece h-puzzle-left">
        <svg viewBox={VIEW} fill="none" overflow="visible" aria-hidden>
          <defs>
            <linearGradient id="hPuzzleGradL" x1="394" y1="268" x2="5" y2="268" gradientUnits="userSpaceOnUse">
              <stop offset="0" className="h-puzzle-stop-mid" />
              <stop offset="0.35" className="h-puzzle-stop-mid" />
              <stop offset="0.7" className="h-puzzle-stop-bot" />
              <stop offset="1" className="h-puzzle-stop-bot" />
            </linearGradient>
          </defs>
          <path d={LEFT_PATH} fill="url(#hPuzzleGradL)" />
        </svg>
      </div>
      <div className="h-puzzle-piece h-puzzle-right">
        <svg viewBox={VIEW} fill="none" overflow="visible" aria-hidden>
          <defs>
            <linearGradient id="hPuzzleGradR" x1="126" y1="268" x2="434" y2="268" gradientUnits="userSpaceOnUse">
              <stop offset="0" className="h-puzzle-stop-top" />
              <stop offset="0.4" className="h-puzzle-stop-mid" />
              <stop offset="0.85" className="h-puzzle-stop-bot" />
              <stop offset="1" className="h-puzzle-stop-bot" />
            </linearGradient>
          </defs>
          <path d={RIGHT_PATH} fill="url(#hPuzzleGradR)" />
        </svg>
      </div>
    </div>
  );
}
