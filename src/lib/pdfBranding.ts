import { readFileSync } from "node:fs";
import { join } from "node:path";

let cachedLogo: string | null | undefined;

/** Server-side data URL used by jsPDF DC generators. */
export function getManproLogoDataUrl(): string | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const bytes = readFileSync(join(process.cwd(), "public", "manpro-logo.png"));
    cachedLogo = `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}
