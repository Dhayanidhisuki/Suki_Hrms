/**
 * POST /api/employees/from-candidate — inbound interface from Recruitment
 * (BRD 01 §9). Single synchronous transaction: validate the handoff payload
 * (field-level errors, no partial creation), check for an existing person
 * (§7.4 rehire), allocate the employee code, create the employee in DRAFT
 * with its first dated job row, audit, emit EMPLOYEE_CREATED, return the
 * code.
 *
 * Idempotent on offerNo (§9.3 rule 7): the JOINING / REHIRE job row stores
 * `OFFER:<offerNo>` in changeReference, so a repeat call returns the
 * previously allocated code without side effects.
 *
 * Rehire (§7.4): a match on personUid / PAN / Aadhaar against a SEPARATED
 * employee of the same company returns 409 with the candidate until the
 * caller resends with confirmRehire=true, which reinstates the original
 * code and opens a new service period. A match on a still-employed person
 * is 409 outright. No Recruitment module exists yet — this is the contract.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { fromCandidateSchema, type FromCandidatePayload } from '@/lib/validations/employee-master';
import { allocateEmployeeCode } from '@/lib/employee/codePolicy';
import { creationChain, initialiseLifecycle, transition, emitTransitionEvent, TransitionError, type TransitionResult } from '@/lib/employee/lifecycle';
import { recordReportingChange, resolveNoticePeriod, utcDay, addDays } from '@/lib/employee/resolveJob';
import { calculateProbationEndDate } from '@/lib/employee-form-fields';
import { encryptField, decryptField } from '@/lib/crypto';
import { audit } from '@/lib/platform/audit/service';
import { emitPlatformEvent } from '@/lib/platform/events';

const ADMIN_ROLE_CODES = new Set(['company-admin', 'hr-admin', 'system-admin']);

function fieldError(field: string, message: string) {
  return NextResponse.json({ error: 'Validation failed', details: { fieldErrors: { [field]: [message] } } }, { status: 400 });
}

const offerRef = (offerNo: string) => `OFFER:${offerNo}`.slice(0, 60);

type ResolvedRefs = {
  departmentId: number;
  designationId: number;
  gradeId: number;
  levelId: number | null;
  employeeTypeId: number;
  locationId: number | null;
  costCentreId: number | null;
  reportingManagerId: number;
};

/** Resolve every coded reference in the payload to ids; first failure wins. */
async function resolveReferences(companyId: number, p: FromCandidatePayload): Promise<{ error: NextResponse } | { ids: ResolvedRefs }> {
  const department = await prisma.department.findFirst({ where: { code: p.departmentCode, deletedAt: null }, select: { id: true } });
  if (!department) return { error: fieldError('departmentCode', `Unknown department code ${p.departmentCode}`) };

  const designation = await prisma.designation.findFirst({ where: { code: p.designationCode, deletedAt: null }, select: { id: true } });
  if (!designation) return { error: fieldError('designationCode', `Unknown designation code ${p.designationCode}`) };

  const grade = await prisma.grade.findFirst({ where: { code: p.gradeCode, deletedAt: null }, select: { id: true, designationId: true } });
  if (!grade) return { error: fieldError('gradeCode', `Unknown grade code ${p.gradeCode}`) };
  if (grade.designationId && grade.designationId !== designation.id) {
    return { error: fieldError('gradeCode', 'Grade must be a grade of the designation') };
  }

  let levelId: number | null = null;
  if (p.levelCode) {
    const level = await prisma.level.findFirst({ where: { code: p.levelCode, gradeId: grade.id, deletedAt: null }, select: { id: true } });
    if (!level) return { error: fieldError('levelCode', `Unknown level code ${p.levelCode} for grade ${p.gradeCode}`) };
    levelId = level.id;
  } else {
    // Defaults to the lowest level of the grade (§9.2).
    const lowest = await prisma.level.findFirst({ where: { gradeId: grade.id, deletedAt: null }, orderBy: { code: 'asc' }, select: { id: true } });
    levelId = lowest?.id ?? null;
  }

  const employeeType = await prisma.employeeType.findFirst({ where: { code: p.employeeTypeCode, deletedAt: null }, select: { id: true } });
  if (!employeeType) return { error: fieldError('employeeTypeCode', `Unknown employee type code ${p.employeeTypeCode}`) };

  let locationId: number | null = null;
  if (p.locationCode) {
    const location = await prisma.location.findFirst({ where: { companyId, code: p.locationCode, deletedAt: null, isActive: true }, select: { id: true } });
    if (!location) return { error: fieldError('locationCode', `Location ${p.locationCode} is not an active location of the company`) };
    locationId = location.id;
  }

  let costCentreId: number | null = null;
  if (p.costCentreCode) {
    const cc = await prisma.costCentre.findFirst({ where: { companyId, code: p.costCentreCode, deletedAt: null, isActive: true }, select: { id: true } });
    if (!cc) return { error: fieldError('costCentreCode', `Cost centre ${p.costCentreCode} is not an active cost centre of the company`) };
    costCentreId = cc.id;
  } else {
    // Department default (§9.2).
    const cc = await prisma.costCentre.findFirst({ where: { companyId, departmentId: department.id, deletedAt: null, isActive: true }, orderBy: { code: 'asc' }, select: { id: true } });
    costCentreId = cc?.id ?? null;
  }

  const manager = await prisma.employee.findFirst({
    where: { companyId, employeeCode: p.reportingManagerCode, deletedAt: null, isActive: true },
    select: { id: true, lifecycleState: true },
  });
  if (!manager || manager.lifecycleState === 'SEPARATED' || manager.lifecycleState === 'SUSPENDED') {
    return { error: fieldError('reportingManagerCode', `Reporting manager ${p.reportingManagerCode} must resolve to an active employee`) };
  }

  return {
    ids: { departmentId: department.id, designationId: designation.id, gradeId: grade.id, levelId, employeeTypeId: employeeType.id, locationId, costCentreId, reportingManagerId: manager.id },
  };
}

/** §7.4 identity match on personUid, PAN or Aadhaar within the company. */
async function findExistingPerson(companyId: number, p: FromCandidatePayload) {
  if (p.personUid) {
    const byUid = await prisma.employee.findFirst({
      where: { companyId, personUid: p.personUid, deletedAt: null },
      select: { id: true, employeeCode: true, oldEmployeeCode: true, firstName: true, lastName: true, lifecycleState: true, status: true, personUid: true },
    });
    if (byUid) return byUid;
  }
  const kycRows = await prisma.employeeKyc.findMany({
    where: { employee: { companyId, deletedAt: null }, OR: [{ panNumberEnc: { not: null } }, { aadhaarNumberEnc: { not: null } }] },
    select: {
      panNumberEnc: true,
      aadhaarNumberEnc: true,
      employee: { select: { id: true, employeeCode: true, oldEmployeeCode: true, firstName: true, lastName: true, lifecycleState: true, status: true, personUid: true } },
    },
  });
  for (const row of kycRows) {
    let pan: string | null = null;
    let aadhaar: string | null = null;
    try {
      pan = decryptField(row.panNumberEnc);
      aadhaar = decryptField(row.aadhaarNumberEnc);
    } catch {
      continue;
    }
    if ((pan && pan.toUpperCase() === p.pan) || (aadhaar && aadhaar === p.aadhaar)) return row.employee;
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const permErr = await checkSpecificPermission(request, 'employee.create');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const parsed = fromCandidateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  const userId = Number(request.headers.get('x-user-id')) || null;
  const actor = { userId, source: 'user' as const };
  const isAdmin = request.headers.get('x-is-superadmin') === 'true' || ADMIN_ROLE_CODES.has(request.headers.get('x-role-code') ?? '');

  // §9.3 rules 4 & 7 — repeat call returns the existing code, no side effects.
  const prior = await prisma.jobInfo.findFirst({
    where: { changeReference: offerRef(p.offerNo), employee: { companyId, deletedAt: null } },
    select: { employee: { select: { id: true, employeeCode: true, lifecycleState: true, personUid: true } } },
  });
  if (prior) {
    const e = prior.employee;
    return NextResponse.json({ employeeId: e.id, employeeCode: e.employeeCode, lifecycleState: e.lifecycleState, personUid: e.personUid, idempotent: true });
  }

  const refs = await resolveReferences(companyId, p);
  if ('error' in refs) return refs.error;
  const ids = refs.ids;

  const dateOfJoining = utcDay(p.dateOfJoining);
  const probationMonths = p.probationMonths ?? null;
  const notice = await resolveNoticePeriod(companyId, ids.gradeId, p.noticePeriodDays ?? null);
  const contactCreate = {
    permanentAddressLine1: p.permanentAddress.line1,
    permanentAddressLine2: p.permanentAddress.line2 ?? null,
    permanentCity: p.permanentAddress.city,
    permanentState: p.permanentAddress.state,
    permanentPincode: p.permanentAddress.pinCode,
    permanentMobile: p.mobile,
    sameAsPermanent: !p.presentAddress,
    presentAddressLine1: (p.presentAddress ?? p.permanentAddress).line1,
    presentAddressLine2: (p.presentAddress ?? p.permanentAddress).line2 ?? null,
    presentCity: (p.presentAddress ?? p.permanentAddress).city,
    presentState: (p.presentAddress ?? p.permanentAddress).state,
    presentPincode: (p.presentAddress ?? p.permanentAddress).pinCode,
    presentMobile: p.mobile,
  };
  const jobRow = {
    departmentId: ids.departmentId,
    designationId: ids.designationId,
    gradeId: ids.gradeId,
    levelId: ids.levelId,
    employeeTypeId: ids.employeeTypeId,
    locationId: ids.locationId,
    costCentreId: ids.costCentreId,
    joinDate: dateOfJoining,
    probationPeriodMonths: probationMonths,
    probationEndDate: calculateProbationEndDate(dateOfJoining, probationMonths),
    noticePeriodDays: notice.days,
    noticePeriodSource: notice.source,
    effectiveFrom: dateOfJoining,
    effectiveTo: null,
    changeReference: offerRef(p.offerNo),
  };

  // §7.4 / §9.3 rule 3 — existing person check before any code is allocated.
  const existing = await findExistingPerson(companyId, p);
  if (existing) {
    const separated = existing.lifecycleState === 'SEPARATED' || (!existing.lifecycleState && (existing.status === 'terminated' || existing.status === 'resigned'));
    if (!separated) {
      return NextResponse.json(
        { error: `This person is already employed under employee code ${existing.oldEmployeeCode ?? existing.employeeCode}`, employeeCode: existing.oldEmployeeCode ?? existing.employeeCode },
        { status: 409 }
      );
    }
    if (!p.confirmRehire) {
      return NextResponse.json(
        {
          error: 'rehire-candidate',
          message: 'A separated employee matches this person — resend with confirmRehire=true to reinstate their original code',
          rehireCandidate: { employeeId: existing.id, employeeCode: existing.oldEmployeeCode ?? existing.employeeCode, name: `${existing.firstName} ${existing.lastName}` },
        },
        { status: 409 }
      );
    }
    if (!isAdmin) return NextResponse.json({ error: 'Confirming a rehire is permitted to HR Admin only' }, { status: 403 });
    if (p.continuityOfService && !p.remark) return fieldError('remark', 'continuityOfService requires a remark');

    try {
      const transitionOpts = {
        trigger: 'REHIRE',
        effectiveDate: dateOfJoining,
        reason: [`Application ${p.sourceApplicationNo}`, p.continuityOfService ? 'continuityOfService=true' : null, p.remark].filter(Boolean).join(' — '),
        referenceNo: p.offerNo,
        rehireTo: probationMonths ? ('PROBATION' as const) : ('CONFIRMED' as const),
        actor,
      };
      let transitionResult: TransitionResult | null = null;
      const rehired = await prisma.$transaction(async (tx) => {
        transitionResult = await transition(companyId, existing.id, 'REHIRED', transitionOpts, tx);

        // New service period: previous rows stay as read-only history (§7.4).
        await tx.jobInfo.updateMany({ where: { employeeId: existing.id, effectiveTo: null }, data: { effectiveTo: addDays(dateOfJoining, -1) } });
        const job = await tx.jobInfo.create({ data: { employeeId: existing.id, ...jobRow, changeReason: 'REHIRE' } });

        const employee = await tx.employee.update({
          where: { id: existing.id },
          data: {
            firstName: p.firstName,
            middleName: p.middleName ?? null,
            lastName: p.lastName,
            isActive: true,
            reportingManagerId: ids.reportingManagerId,
            secondReportingManagerId: null,
            personUid: existing.personUid ?? p.personUid ?? randomUUID(),
            personalDetails: {
              upsert: {
                create: { dateOfBirth: p.dateOfBirth, gender: p.gender, personalEmail: p.personalEmail },
                update: { dateOfBirth: p.dateOfBirth, gender: p.gender, personalEmail: p.personalEmail },
              },
            },
            contactDetails: { upsert: { create: contactCreate, update: contactCreate } },
            kyc: {
              upsert: {
                create: { panNumberEnc: encryptField(p.pan), aadhaarNumberEnc: encryptField(p.aadhaar), verificationStatus: 'pending' },
                update: { panNumberEnc: encryptField(p.pan), aadhaarNumberEnc: encryptField(p.aadhaar) },
              },
            },
          },
          select: { id: true, employeeCode: true, lifecycleState: true, personUid: true },
        });

        await recordReportingChange(
          { companyId, employeeId: existing.id, primaryManagerId: ids.reportingManagerId, secondaryManagerId: null, effectiveFrom: dateOfJoining, changeReason: 'REHIRE', actor },
          tx
        );
        await audit(
          {
            companyId,
            entityType: 'Employee',
            entityId: existing.id,
            entityRef: employee.employeeCode,
            action: 'REHIRE',
            actor,
            after: { offerNo: p.offerNo, sourceApplicationNo: p.sourceApplicationNo, jobInfoId: job.id, annualCtc: p.annualCtc, continuityOfService: p.continuityOfService ?? false },
            remark: p.remark ?? null,
          },
          tx
        );
        return employee;
      });

      if (transitionResult) await emitTransitionEvent(companyId, transitionResult, transitionOpts);
      await emitPlatformEvent(companyId, 'EMPLOYEE_REHIRED', {
        moduleCode: 'CORE',
        sourceEntityType: 'Employee',
        sourceEntityId: rehired.id,
        subjectEmpId: rehired.id,
        linkPath: `/employees/${rehired.id}`,
        data: { Employee: { code: rehired.employeeCode, offerNo: p.offerNo } },
      });
      return NextResponse.json({ ...rehired, rehired: true }, { status: 200 });
    } catch (err) {
      if (err instanceof TransitionError) return NextResponse.json({ error: err.message }, { status: err.status });
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Rehire failed' }, { status: 400 });
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const employeeCode = await allocateEmployeeCode(companyId, tx);
      const employee = await tx.employee.create({
        data: {
          companyId,
          employeeCode,
          firstName: p.firstName,
          middleName: p.middleName ?? null,
          lastName: p.lastName,
          status: 'active',
          personUid: p.personUid ?? randomUUID(),
          reportingManagerId: ids.reportingManagerId,
          personalDetails: { create: { dateOfBirth: p.dateOfBirth, gender: p.gender, personalEmail: p.personalEmail } },
          contactDetails: { create: contactCreate },
          kyc: { create: { panNumberEnc: encryptField(p.pan), aadhaarNumberEnc: encryptField(p.aadhaar), verificationStatus: 'pending' } },
          jobInfos: { create: [{ ...jobRow, changeReason: 'JOINING' }] },
        },
        select: { id: true, employeeCode: true, personUid: true },
      });

      const lifecycleState = await initialiseLifecycle(
        companyId,
        employee.id,
        creationChain({ draftOnly: true }),
        { trigger: 'RECRUITMENT_HANDOFF', effectiveDate: dateOfJoining, actor, reason: `Application ${p.sourceApplicationNo}`, referenceNo: p.offerNo },
        tx
      );
      await recordReportingChange(
        { companyId, employeeId: employee.id, primaryManagerId: ids.reportingManagerId, secondaryManagerId: null, effectiveFrom: dateOfJoining, changeReason: 'JOINING', actor },
        tx
      );
      await audit(
        {
          companyId,
          entityType: 'Employee',
          entityId: employee.id,
          entityRef: employee.employeeCode,
          action: 'CREATE',
          actor,
          after: { employeeCode: employee.employeeCode, lifecycleState, offerNo: p.offerNo, sourceApplicationNo: p.sourceApplicationNo, annualCtc: p.annualCtc },
        },
        tx
      );
      return { ...employee, lifecycleState };
    });

    await emitPlatformEvent(companyId, 'EMPLOYEE_CREATED', {
      moduleCode: 'CORE',
      sourceEntityType: 'Employee',
      sourceEntityId: created.id,
      subjectEmpId: created.id,
      linkPath: `/employees/${created.id}`,
      data: { Employee: { code: created.employeeCode, source: 'RECRUITMENT', offerNo: p.offerNo } },
    });
    return NextResponse.json({ employeeId: created.id, employeeCode: created.employeeCode, lifecycleState: created.lifecycleState, personUid: created.personUid }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create employee' }, { status: 400 });
  }
}
