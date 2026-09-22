import {
  HRMS_MARK_LEFT,
  HRMS_MARK_RATIO,
  HRMS_MARK_RIGHT,
  HRMS_MARK_VIEWBOX,
} from "@/components/brand/hrmsMark";

interface HPuzzleLoaderProps {
  size?: number;
  className?: string;
}

/**
 * Two-piece Suki H-mark. Pieces slide in, lock, then pull apart.
 */
export function HPuzzleLoader({ size = 168, className = "" }: HPuzzleLoaderProps) {
  return (
    <div
      className={`h-puzzle ${className}`.trim()}
      style={{ width: size * HRMS_MARK_RATIO, height: size }}
      role="status"
      aria-label="Loading"
    >
      <div className="h-puzzle-piece h-puzzle-left">
        <svg viewBox={HRMS_MARK_VIEWBOX} fill="none" overflow="visible" aria-hidden>
          <defs>
            <linearGradient id="hPuzzleGradL" x1="394" y1="268" x2="5" y2="268" gradientUnits="userSpaceOnUse">
              <stop offset="0" className="h-puzzle-stop-mid" />
              <stop offset="0.35" className="h-puzzle-stop-mid" />
              <stop offset="0.7" className="h-puzzle-stop-bot" />
              <stop offset="1" className="h-puzzle-stop-bot" />
            </linearGradient>
          </defs>
          <path d={HRMS_MARK_LEFT} fill="url(#hPuzzleGradL)" />
        </svg>
      </div>
      <div className="h-puzzle-piece h-puzzle-right">
        <svg viewBox={HRMS_MARK_VIEWBOX} fill="none" overflow="visible" aria-hidden>
          <defs>
            <linearGradient id="hPuzzleGradR" x1="126" y1="268" x2="434" y2="268" gradientUnits="userSpaceOnUse">
              <stop offset="0" className="h-puzzle-stop-top" />
              <stop offset="0.4" className="h-puzzle-stop-mid" />
              <stop offset="0.85" className="h-puzzle-stop-bot" />
              <stop offset="1" className="h-puzzle-stop-bot" />
            </linearGradient>
          </defs>
          <path d={HRMS_MARK_RIGHT} fill="url(#hPuzzleGradR)" />
        </svg>
      </div>
    </div>
  );
}
