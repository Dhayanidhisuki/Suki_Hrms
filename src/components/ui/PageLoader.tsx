import { HPuzzleLoader } from "./HPuzzleLoader";

/** Full-screen branded loader. Page stays visible underneath a blur scrim. */
export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-md">
      <HPuzzleLoader size={96} />
    </div>
  );
}
