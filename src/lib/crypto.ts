/**
 * Field-level encryption for sensitive KYC values (PAN, Aadhaar, bank account
 * numbers). AES-256-GCM via Node's built-in crypto — no external dependency.
 *
 * Ciphertext format (single base64 string, so it fits in one NVARCHAR column):
 *   base64(iv [12 bytes] || authTag [16 bytes] || ciphertext)
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is not set — cannot encrypt/decrypt KYC fields.');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded).');
  }
  return key;
}

/** Encrypt a plaintext value for storage. Returns null if input is null/empty. */
export function encryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/** Decrypt a stored ciphertext value. Returns null if input is null/empty. */
export function decryptField(ciphertext: string | null | undefined): string | null {
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') return null;
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * Mask a value for display, revealing only the last `visibleTailChars`
 * characters (e.g. "XXXXXXXX1234"). Never call with a decrypted value unless
 * the caller has the corresponding view permission.
 */
export function maskValue(value: string | null | undefined, visibleTailChars = 4): string | null {
  if (!value) return null;
  if (value.length <= visibleTailChars) return 'X'.repeat(value.length);
  return 'X'.repeat(value.length - visibleTailChars) + value.slice(-visibleTailChars);
}
