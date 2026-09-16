import { describe, it, expect } from 'vitest';
import { parseScopeValues, isUnrestricted } from '@/lib/employee/scope';

describe('data scope — helpers (§20)', () => {
  it('parses the stored comma list, trimming blanks', () => {
    expect(parseScopeValues('DEP-PRD, DEP-QLY ,,')).toEqual(['DEP-PRD', 'DEP-QLY']);
    expect(parseScopeValues(null)).toEqual([]);
    expect(parseScopeValues('')).toEqual([]);
  });

  it('GLOBAL or COMPANY anywhere in the assignments means unrestricted', () => {
    expect(isUnrestricted([{ scopeType: 'DEPARTMENT', scopeValues: 'X', treeDepth: null }])).toBe(false);
    expect(isUnrestricted([{ scopeType: 'DEPARTMENT', scopeValues: 'X', treeDepth: null }, { scopeType: 'COMPANY', scopeValues: null, treeDepth: null }])).toBe(true);
    expect(isUnrestricted([{ scopeType: 'GLOBAL', scopeValues: null, treeDepth: null }])).toBe(true);
    expect(isUnrestricted([])).toBe(false);
  });
});
