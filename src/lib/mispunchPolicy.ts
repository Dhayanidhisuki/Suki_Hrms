/**
 * How far back a mis-punch (biometric correction) request can be dated, and
 * how many an employee may file in a calendar month.
 *
 * Same reasoning as permissionPolicy.ts: several call sites (the ESS submit
 * form, the API's own guard, the countdown display) need the same numbers, so
 * they all read through here instead of carrying their own defaults.
 */

import { prisma } from './prisma';

/** Used only when a company has no MispunchPolicy row of its own. */
export const DEFAULT_MAX_BACKDATE_DAYS = 60;
export const DEFAULT_MAX_REQUESTS_PER_MONTH = 15;

export interface MispunchPolicyValues {
  maxBackdateDays: number;
  maxRequestsPerMonth: number;
}

export async function getMispunchPolicy(companyId: number): Promise<MispunchPolicyValues> {
  const policy = await prisma.mispunchPolicy.findUnique({
    where: { companyId },
    select: { maxBackdateDays: true, maxRequestsPerMonth: true },
  });
  return {
    maxBackdateDays: policy?.maxBackdateDays ?? DEFAULT_MAX_BACKDATE_DAYS,
    maxRequestsPerMonth: policy?.maxRequestsPerMonth ?? DEFAULT_MAX_REQUESTS_PER_MONTH,
  };
}
