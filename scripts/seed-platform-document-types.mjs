/**
 * Seeds the BRD §15.3 Document Type Master (25 rows) into every active
 * company. Idempotent: upserts on (companyId, code) and refreshes the
 * configured values each run; never touches PlatformDocument rows.
 *
 *   node scripts/seed-platform-document-types.mjs
 */

import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const VERIFIER_ROLE = "hr-admin";
const DEFAULT_OFFSETS = "60,30,15,7,0";

// §17.1.1 alert offsets for the expiry-critical types.
const OFFSETS = {
  MEDICAL_FITNESS: "60,30,15,7,0",
  SAFETY_INDUCTION: "60,30,15,7,0",
  SKILL_CERT: "90,60,30,7,0",
  CONTRACT_AGREEMENT: "90,60,30,15,0",
  HR_POLICY: "30,15,0",
  TRAINING_CERT: "60,30,7,0",
};

// [code, name, entity, category, class, mandatory, verify, expiry, types, maxMb, multi, retainYears] — §15.3 verbatim.
const ROWS = [
  ["AADHAAR", "Aadhaar (masked)", "EMPLOYEE", "IDENTITY", "RESTRICTED", true, true, false, "pdf,jpg,png", 5, true, 8],
  ["PAN", "PAN Card", "EMPLOYEE", "IDENTITY", "RESTRICTED", true, true, false, "pdf,jpg,png", 5, false, 8],
  ["BANK_PROOF", "Cancelled cheque or bank passbook", "EMPLOYEE", "FINANCIAL", "RESTRICTED", true, true, false, "pdf,jpg,png", 5, false, 8],
  ["PHOTO", "Passport photograph", "EMPLOYEE", "IDENTITY", "INTERNAL", true, false, false, "jpg,png", 2, false, 8],
  ["ADDRESS_PROOF", "Address proof", "EMPLOYEE", "IDENTITY", "CONFIDENTIAL", true, true, false, "pdf,jpg,png", 5, true, 8],
  ["SSLC", "10th standard certificate", "CANDIDATE", "EDUCATION", "CONFIDENTIAL", true, true, false, "pdf,jpg", 5, false, 3],
  ["HSC", "12th standard certificate", "CANDIDATE", "EDUCATION", "CONFIDENTIAL", false, true, false, "pdf,jpg", 5, false, 3],
  ["DEGREE_CERT", "Degree or diploma certificate", "CANDIDATE", "EDUCATION", "CONFIDENTIAL", true, true, false, "pdf,jpg", 10, true, 3],
  ["EXPERIENCE_CERT", "Experience certificate", "CANDIDATE", "EMPLOYMENT", "CONFIDENTIAL", false, true, false, "pdf", 10, true, 3],
  ["RELIEVING_LETTER", "Relieving letter from previous employer", "CANDIDATE", "EMPLOYMENT", "CONFIDENTIAL", false, true, false, "pdf", 10, true, 3],
  ["PAYSLIP_PREV", "Previous employer payslip", "CANDIDATE", "FINANCIAL", "RESTRICTED", false, true, false, "pdf", 5, true, 1],
  ["OFFER_LETTER", "Offer letter issued", "CANDIDATE", "EMPLOYMENT", "CONFIDENTIAL", true, false, false, "pdf", 10, false, 8],
  ["APPOINTMENT_LETTER", "Appointment letter", "EMPLOYEE", "EMPLOYMENT", "CONFIDENTIAL", true, false, false, "pdf", 10, false, 8],
  ["MEDICAL_FITNESS", "Pre-employment medical fitness certificate", "EMPLOYEE", "MEDICAL", "RESTRICTED", true, true, true, "pdf", 10, false, 8],
  ["SAFETY_INDUCTION", "Shop floor safety induction record", "EMPLOYEE", "TRAINING", "INTERNAL", true, true, true, "pdf", 10, false, 5],
  ["SKILL_CERT", "Machine operation skill certification", "EMPLOYEE", "TRAINING", "INTERNAL", false, true, true, "pdf", 10, true, 5],
  ["TRAINING_MATERIAL", "Training material and work instructions", "TRAINING", "TRAINING", "INTERNAL", false, false, false, "pdf,ppt,pptx,mp4", 50, true, 5],
  ["TRAINING_CERT", "Training completion certificate", "EMPLOYEE", "TRAINING", "INTERNAL", false, false, true, "pdf", 5, true, 5],
  ["CONTRACT_AGREEMENT", "Contractor agreement", "CONTRACTOR", "EMPLOYMENT", "CONFIDENTIAL", true, true, true, "pdf", 25, false, 8],
  ["EXIT_CLEARANCE", "Departmental clearance form", "EMPLOYEE", "EXIT", "INTERNAL", true, true, false, "pdf", 10, true, 8],
  ["RESIGNATION_LETTER", "Resignation letter", "EMPLOYEE", "EXIT", "CONFIDENTIAL", true, true, false, "pdf,jpg", 5, false, 8],
  ["FNF_STATEMENT", "Full and final settlement statement", "EMPLOYEE", "EXIT", "RESTRICTED", true, false, false, "pdf", 10, false, 8],
  ["FORM16", "Form 16", "EMPLOYEE", "STATUTORY", "RESTRICTED", true, false, false, "pdf", 10, false, 8],
  ["ASSET_HANDOVER", "Asset issue and return acknowledgement", "ASSET", "ASSET", "INTERNAL", true, true, false, "pdf,jpg", 5, true, 5],
  ["HR_POLICY", "Company policy document", "COMPANY", "COMPANY", "PUBLIC", false, false, true, "pdf", 25, false, 8],
];

function toData(row) {
  const [code, name, appliesToEntity, category, documentClass, mandatoryFlag, verify, expiryRequired, allowedFileTypes, maxFileSizeMb, multi, retentionYears] = row;
  return {
    code,
    name,
    category,
    appliesToEntity,
    documentClass,
    mandatoryFlag,
    mandatoryFromStage: appliesToEntity === "EMPLOYEE" ? "JOINING" : appliesToEntity === "CANDIDATE" ? "OFFER_ACCEPTED" : null,
    verificationRequired: verify,
    verifierRole: verify ? VERIFIER_ROLE : null,
    expiryRequired,
    expiryAlertOffsets: expiryRequired ? (OFFSETS[code] ?? DEFAULT_OFFSETS) : null,
    allowedFileTypes,
    maxFileSizeMb,
    maxFileCount: multi ? 2 : 1,
    retentionYears,
    isActive: true,
  };
}

try {
  const companies = await prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, code: true } });
  let upserts = 0;
  for (const company of companies) {
    for (const row of ROWS) {
      const data = toData(row);
      await prisma.platformDocumentType.upsert({
        where: { companyId_code: { companyId: company.id, code: data.code } },
        update: data,
        create: { companyId: company.id, ...data },
      });
      upserts++;
    }
    console.log(`Company ${company.code} (#${company.id}): ${ROWS.length} document types upserted.`);
  }
  console.log(`Done — ${upserts} upserts across ${companies.length} company(ies).`);
} finally {
  await prisma.$disconnect();
}
