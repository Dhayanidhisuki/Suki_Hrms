import { describe, it, expect } from 'vitest';
import { formatEmployeeCode, parseEmployeeCode, deriveCodePolicyFromCodes, DEFAULT_CODE_POLICY } from '@/lib/employee/codePolicy';

describe('employee code policy — formatting (BRD 01 §7.2)', () => {
  it('zero-pads to the configured width', () => {
    expect(formatEmployeeCode('EMP', 3, 27)).toBe('EMP027');
    expect(formatEmployeeCode('EMP', 3, 28)).toBe('EMP028');
    expect(formatEmployeeCode('RC', 3, 116)).toBe('RC116');
  });

  it('auto-expands the width and never truncates', () => {
    expect(formatEmployeeCode('EMP', 3, 1000)).toBe('EMP1000');
    expect(formatEmployeeCode('EMP', 3, 123456)).toBe('EMP123456');
    expect(formatEmployeeCode('E', 5, 7)).toBe('E00007');
  });

  it('parses series codes and rejects non-series ones', () => {
    expect(parseEmployeeCode('RC027')).toEqual({ prefix: 'RC', sequence: 27, width: 3 });
    expect(parseEmployeeCode('emp1000')).toEqual({ prefix: 'EMP', sequence: 1000, width: 4 });
    expect(parseEmployeeCode('TEST-AUTO-1')).toBeNull();
    expect(parseEmployeeCode('12345')).toBeNull();
    expect(parseEmployeeCode('TOOLONGPREFIX1')).toBeNull();
  });
});

describe('employee code policy — derivation from existing codes (§7.2 high-water mark)', () => {
  it('derives prefix / width / next from the dominant series', () => {
    const codes = ['RC027', 'RC028', 'RC029', 'RC114', 'RC115', 'TEST-AUTO-1'];
    expect(deriveCodePolicyFromCodes(codes)).toEqual({ prefix: 'RC', width: 3, nextSequence: 116 });
  });

  it('uses the BRD example: high-water mark 026 → next 027', () => {
    expect(deriveCodePolicyFromCodes(['EMP001', 'EMP026', 'EMP010'])).toEqual({ prefix: 'EMP', width: 3, nextSequence: 27 });
  });

  it('prefers the series most employees carry, ties broken by the higher max', () => {
    expect(deriveCodePolicyFromCodes(['EMP001', 'EMP002', 'RC900']).prefix).toBe('EMP');
    expect(deriveCodePolicyFromCodes(['EMP001', 'RC900']).prefix).toBe('RC');
  });

  it('takes the modal width of the chosen series', () => {
    expect(deriveCodePolicyFromCodes(['EMP0001', 'EMP0002', 'EMP0003', 'EMP9']).width).toBe(4);
  });

  it('falls back to the defaults when nothing is in series form', () => {
    expect(deriveCodePolicyFromCodes([])).toEqual(DEFAULT_CODE_POLICY);
    expect(deriveCodePolicyFromCodes(['TEST-AUTO-x', 'A-1'])).toEqual(DEFAULT_CODE_POLICY);
  });
});
