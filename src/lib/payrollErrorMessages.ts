/**
 * BRD §22 — Payroll error message catalog.
 *
 * Maps validation codes to user-friendly error messages with error codes
 * for traceability. Each message includes a code (e.g. PR-001) and a
 * human-readable description.
 *
 * The validation engine in payrollValidation.ts produces validation codes;
 * this catalog maps those codes to the BRD's 9 standard error messages.
 */

export interface PayrollErrorMessage {
  code: string;        // e.g. "PR-001"
  validationCode: string; // matches ValidationResult.code
  message: string;     // user-friendly message
  severity: 'ERROR' | 'WARNING' | 'INFO';
}

export const PAYROLL_ERROR_MESSAGES: PayrollErrorMessage[] = [
  {
    code: 'PR-001',
    validationCode: 'NEG_NET',
    message: 'Net salary is negative. Please review deductions and earnings.',
    severity: 'ERROR',
  },
  {
    code: 'PR-002',
    validationCode: 'NET_BELOW_MIN',
    message: 'Net salary is below the minimum percentage of gross. Check for excessive deductions.',
    severity: 'ERROR',
  },
  {
    code: 'PR-003',
    validationCode: 'DEDUCT_EXCEED',
    message: 'Total deductions exceed the maximum allowed percentage of gross salary.',
    severity: 'ERROR',
  },
  {
    code: 'PR-004',
    validationCode: 'OT_EXCEED_HRS',
    message: 'Overtime hours exceed the monthly cap defined in the OT plan.',
    severity: 'ERROR',
  },
  {
    code: 'PR-005',
    validationCode: 'OT_EXCEED_PCT',
    message: 'Overtime amount exceeds the allowed percentage of gross salary.',
    severity: 'WARNING',
  },
  {
    code: 'PR-006',
    validationCode: 'LOP_EXCEED',
    message: 'Loss of Pay days exceed the monthly limit. Verify attendance data.',
    severity: 'WARNING',
  },
  {
    code: 'PR-007',
    validationCode: 'ATTN_NOT_FROZEN',
    message: 'Attendance is not finalized. Finalize attendance before processing payroll.',
    severity: 'WARNING',
  },
  {
    code: 'PR-008',
    validationCode: 'DUP_COMPONENT',
    message: 'Duplicate salary component detected. Remove the duplicate before proceeding.',
    severity: 'ERROR',
  },
  {
    code: 'PR-009',
    validationCode: 'PAYABLE_BELOW_MIN',
    message: 'Payable days are below the minimum required. Check attendance and LOP.',
    severity: 'WARNING',
  },
  {
    code: 'PR-010',
    validationCode: 'ZERO_GROSS',
    message: 'Gross earnings are zero. Verify salary structure is assigned.',
    severity: 'WARNING',
  },
];

/**
 * Get the BRD error message for a validation code.
 */
export function getErrorMessage(validationCode: string): PayrollErrorMessage | undefined {
  return PAYROLL_ERROR_MESSAGES.find((m) => m.validationCode === validationCode);
}

/**
 * Get all error messages for a list of validation codes.
 */
export function getErrorMessages(validationCodes: string[]): PayrollErrorMessage[] {
  return validationCodes
    .map((code) => getErrorMessage(code))
    .filter((m): m is PayrollErrorMessage => m !== undefined);
}
