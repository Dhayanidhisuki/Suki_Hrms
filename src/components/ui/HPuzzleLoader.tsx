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
 * Same H mark as `src/app/icon.svg`, in the Next.js rounded-square icon
 * treatment, with a spinning ring while the page loads.
 */
export function HPuzzleLoader({ size = 96, className = "" }: HPuzzleLoaderProps) {
  const markHeight = size * 0.75;
  const markWidth = markHeight * HRMS_MARK_RATIO;

  return (
    <div
      className={`hrms-app-icon ${className}`.trim()}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <span className="hrms-app-icon-ring" aria-hidden />
      <div className="hrms-app-icon-plate">
        <svg
          viewBox={HRMS_MARK_VIEWBOX}
          width={markWidth}
          height={markHeight}
          fill="none"
          aria-hidden
          className="hrms-app-icon-mark"
        >
          <defs>
            <linearGradient id="hrmsIconLoadL" x1="394" y1="268" x2="5" y2="268" gradientUnits="userSpaceOnUse">
              <stop offset="0" className="h-puzzle-stop-top" />
              <stop offset="0.2" className="h-puzzle-stop-mid" />
              <stop offset="0.65" className="h-puzzle-stop-bot" />
              <stop offset="1" className="h-puzzle-stop-bot" />
            </linearGradient>
            <linearGradient id="hrmsIconLoadR" x1="126" y1="268" x2="434" y2="268" gradientUnits="userSpaceOnUse">
              <stop offset="0" className="h-puzzle-stop-top" />
              <stop offset="0.4" className="h-puzzle-stop-mid" />
              <stop offset="0.85" className="h-puzzle-stop-bot" />
              <stop offset="1" className="h-puzzle-stop-bot" />
            </linearGradient>
          </defs>
          <path d={HRMS_MARK_LEFT} fill="url(#hrmsIconLoadL)" />
          <path d={HRMS_MARK_RIGHT} fill="url(#hrmsIconLoadR)" />
        </svg>
      </div>
    </div>
  );
}
