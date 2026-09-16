/**
 * Demo workflow configuration for company KUNAERO:
 *   request type LEAVE_APPLICATION (module LEAV, no handler) and a two-level
 *   fallback matrix LEAVE-DEFAULT:
 *     L1  POSITION REQUESTER_MANAGER_L1   SLA 2.0d, escalate APPROVER_MANAGER_L1, ADD
 *     L2  ROLE     hr-admin               SLA 2.0d, escalate APPROVER_MANAGER_L1, ADD
 * Idempotent: re-running updates the request type in place and leaves an
 * existing matrix untouched (a matrix bound to live requests is never edited —
 * create a new version through PUT /api/platform/workflow/matrices/[id]).
 *
 *   node scripts/seed-platform-workflow-demo.mjs
 */

import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const { PrismaClient, Prisma } = await import("@prisma/client");
const prisma = new PrismaClient();

const COMPANY_CODE = "KUNAERO";
const REQUEST_TYPE = "LEAVE_APPLICATION";
const MATRIX_CODE = "LEAVE-DEFAULT";

try {
  const company = await prisma.company.findFirst({ where: { code: COMPANY_CODE, deletedAt: null }, select: { id: true, code: true } });
  if (!company) throw new Error(`Company ${COMPANY_CODE} not found`);

  const requestType = await prisma.workflowRequestType.upsert({
    where: { companyId_code: { companyId: company.id, code: REQUEST_TYPE } },
    update: {
      name: "Leave Application",
      moduleCode: "LEAV",
      handlerKey: null,
      conditionFieldsUsed: "department,designation,grade",
      allowReturn: true,
      allowCancelAfterSubmit: true,
      allowBulkApproval: true,
      allowDelegation: true,
      autoApproveOnExhaustion: false,
      remarkMandatoryOnApprove: false,
      snapshotTypeCode: null,
      isActive: true,
    },
    create: {
      companyId: company.id,
      code: REQUEST_TYPE,
      name: "Leave Application",
      moduleCode: "LEAV",
      handlerKey: null,
      conditionFieldsUsed: "department,designation,grade",
      allowBulkApproval: true,
    },
  });
  console.log(`Request type ${requestType.code} (id ${requestType.id}) ready for ${company.code}.`);

  const existing = await prisma.workflowMatrix.findFirst({ where: { companyId: company.id, code: MATRIX_CODE }, orderBy: { versionNo: "desc" } });
  if (existing) {
    const lines = await prisma.workflowMatrixLine.count({ where: { matrixId: existing.id } });
    console.log(`Matrix ${MATRIX_CODE} v${existing.versionNo} (id ${existing.id}) already exists with ${lines} lines — left untouched.`);
  } else {
    const today = new Date();
    const matrix = await prisma.$transaction(async (tx) => {
      const m = await tx.workflowMatrix.create({
        data: {
          companyId: company.id,
          code: MATRIX_CODE,
          name: "Leave application — default (manager, then HR)",
          requestTypeCode: REQUEST_TYPE,
          versionNo: 1,
          effectiveFrom: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
          effectiveTo: null,
          isFallback: true,
          status: "Active",
        },
      });
      await tx.workflowMatrixLine.createMany({
        data: [
          {
            matrixId: m.id,
            levelNo: 1,
            sequence: 1,
            parallelGroup: null,
            approverType: "POSITION",
            approverRef: "REQUESTER_MANAGER_L1",
            mandatory: true,
            quorumRule: "ALL",
            escalationDays: new Prisma.Decimal("2.0"),
            escalationTargetType: "POSITION",
            escalationTargetRef: "APPROVER_MANAGER_L1",
            escalationMode: "ADD",
            maxEscalationHops: 2,
            skipIfSameAsRequester: true,
          },
          {
            matrixId: m.id,
            levelNo: 2,
            sequence: 1,
            parallelGroup: null,
            approverType: "ROLE",
            approverRef: "hr-admin",
            mandatory: true,
            quorumRule: "ALL",
            escalationDays: new Prisma.Decimal("2.0"),
            escalationTargetType: "POSITION",
            escalationTargetRef: "APPROVER_MANAGER_L1",
            escalationMode: "ADD",
            maxEscalationHops: 2,
            skipIfSameAsRequester: true,
          },
        ],
      });
      return m;
    });
    console.log(`Created matrix ${MATRIX_CODE} v1 (id ${matrix.id}) with 2 levels.`);
  }
} finally {
  await prisma.$disconnect();
}
