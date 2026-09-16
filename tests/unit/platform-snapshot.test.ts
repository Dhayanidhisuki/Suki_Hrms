import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { canonicalJson, sha256Hash } from '@/lib/platform/snapshot/canonical';

describe('platform snapshot — canonicalJson', () => {
  it('is independent of key insertion order', () => {
    const a = canonicalJson({ b: 1, a: 2, c: { z: 1, y: 2 } });
    const b = canonicalJson({ c: { y: 2, z: 1 }, a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1,"c":{"y":2,"z":1}}');
  });

  it('emits no whitespace', () => {
    expect(canonicalJson({ a: [1, 2, { b: 'x y' }] })).toBe('{"a":[1,2,{"b":"x y"}]}');
  });

  it('serialises Prisma.Decimal as its exact normalised string, never a float', () => {
    const json = canonicalJson({ amount: new Prisma.Decimal('45000.10'), rate: new Prisma.Decimal('0.12') });
    expect(json).toBe('{"amount":"45000.1","rate":"0.12"}');
    // Equal decimals written with different scale canonicalise identically.
    expect(canonicalJson({ v: new Prisma.Decimal('1.500') })).toBe(canonicalJson({ v: new Prisma.Decimal('1.5') }));
    // Large values never fall into exponent notation.
    expect(canonicalJson({ v: new Prisma.Decimal('123456789012345678.99') })).toBe('{"v":"123456789012345678.99"}');
  });

  it('serialises Date as ISO-8601 and BigInt as a decimal string', () => {
    const json = canonicalJson({ at: new Date(Date.UTC(2026, 8, 30)), big: BigInt('9007199254740993') });
    expect(json).toBe('{"at":"2026-09-30T00:00:00.000Z","big":"9007199254740993"}');
  });

  it('keeps array order and sorts keys inside nested array elements', () => {
    const json = canonicalJson({ criteria: [{ weight: 30, name: 'Coding' }, { weight: 20, name: 'Communication' }] });
    expect(json).toBe('{"criteria":[{"name":"Coding","weight":30},{"name":"Communication","weight":20}]}');
  });

  it('drops undefined properties and nulls undefined array items', () => {
    expect(canonicalJson({ a: undefined, b: null, c: [undefined, 1] })).toBe('{"b":null,"c":[null,1]}');
  });

  it('primitives and null at the top level', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson('x')).toBe('"x"');
    expect(canonicalJson(5)).toBe('5');
  });
});

describe('platform snapshot — sha256Hash / verify', () => {
  it('hashes the canonical form, so key order does not change the hash', () => {
    const h1 = sha256Hash({ b: 1, a: [new Prisma.Decimal('1.50')] });
    const h2 = sha256Hash({ a: [new Prisma.Decimal('1.50')], b: 1 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes a pre-canonicalised string identically to hashing the value', () => {
    const value = { salary: { basic: new Prisma.Decimal('18000.00') }, attendance: { paidDays: 22 } };
    expect(sha256Hash(canonicalJson(value))).toBe(sha256Hash(value));
  });

  it('detects divergence: any content change changes the hash', () => {
    const stored = canonicalJson({ leave: { earnedLeaveBalance: 11.5 } });
    const storedHash = sha256Hash(stored);
    const tampered = canonicalJson({ leave: { earnedLeaveBalance: 13.5 } });
    expect(sha256Hash(tampered)).not.toBe(storedHash);
    // verifySnapshot's rule: re-canonicalise the parsed stored JSON and compare.
    expect(sha256Hash(canonicalJson(JSON.parse(stored)))).toBe(storedHash);
  });
});
