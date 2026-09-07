/**
 * Loads .env into process.env before any test file runs — Vitest doesn't do
 * this automatically the way Next.js does. Reuses the same manual parser as
 * scripts/*.mjs (no dotenv dependency).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');

for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const value = m[2].trim().replace(/^["']|["']$/g, '');
  if (!process.env[m[1]]) process.env[m[1]] = value;
}
