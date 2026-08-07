import { LogoSpinner } from "./LogoSpinner";

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--bg-app)]/85 backdrop-blur-sm">
      <LogoSpinner size={84} />
    </div>
  );
}
