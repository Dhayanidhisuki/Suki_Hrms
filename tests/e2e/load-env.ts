import { readFileSync } from 'node:fs';
import path from 'node:path';

export function loadRepoEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
  try {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  } catch {
    // DATABASE_URL may already be in the environment.
  }
}

loadRepoEnv();
