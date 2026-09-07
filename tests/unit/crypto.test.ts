import { describe, it, expect } from 'vitest';
import { encryptField, decryptField, maskValue } from '@/lib/crypto';

describe('crypto (AES-256-GCM field encryption)', () => {
  it('round-trips a plaintext value through encrypt/decrypt', () => {
    const plaintext = 'ABCDE1234F';
    const ciphertext = encryptField(plaintext);
    expect(ciphertext).not.toBeNull();
    expect(ciphertext).not.toBe(plaintext);
    expect(decryptField(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const a = encryptField('123456789012');
    const b = encryptField('123456789012');
    expect(a).not.toBe(b);
  });

  it('returns null for null/undefined/empty input on both encrypt and decrypt', () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField(undefined)).toBeNull();
    expect(encryptField('')).toBeNull();
    expect(decryptField(null)).toBeNull();
    expect(decryptField(undefined)).toBeNull();
    expect(decryptField('')).toBeNull();
  });

  it('rejects tampered ciphertext (GCM auth tag catches it)', () => {
    const ciphertext = encryptField('ABCDE1234F')!;
    const tampered = ciphertext.slice(0, -4) + 'AAAA';
    expect(() => decryptField(tampered)).toThrow();
  });
});

describe('maskValue', () => {
  it('masks all but the last 4 characters by default', () => {
    expect(maskValue('ABCDE1234F')).toBe('XXXXXX234F');
    expect(maskValue('123456789012')).toBe('XXXXXXXX9012');
  });

  it('masks the whole value when shorter than the visible tail', () => {
    expect(maskValue('AB', 4)).toBe('XX');
  });

  it('returns null for null/undefined/empty input', () => {
    expect(maskValue(null)).toBeNull();
    expect(maskValue(undefined)).toBeNull();
    expect(maskValue('')).toBeNull();
  });
});
