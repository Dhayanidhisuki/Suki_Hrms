import { z } from "zod";

// ── Auth ──────────────────────────────────────────────────────────
export const VerifyTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// ── Supplier ─────────────────────────────────────────────────────
export const SupplierCreateSchema = z.object({
  supCode: z.string().min(1).max(20),
  supName: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  gstin: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  bankName: z.string().max(100).optional(),
  accountNo: z.string().max(30).optional(),
  ifscCode: z.string().max(20).optional(),
  isApproved: z.boolean().optional().default(false),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
export const SupplierUpdateSchema = SupplierCreateSchema.partial().extend({
  id: z.number(),
});

// ── Subcontractor ─────────────────────────────────────────────────
export const SubcontractorCreateSchema = z.object({
  subCode: z.string().min(1).max(20),
  subName: z.string().min(1).max(200),
  natureOfWork: z.string().max(200).optional(),
  isStoreVendor: z.boolean().default(false),
  isInhouse: z.boolean().default(false),
  isIssueDc: z.boolean().default(false),
  address: z.string().max(500).optional(),
  gstin: z.string().max(20).optional(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

// ── Lookup Masters ────────────────────────────────────────────────
export const ToolsTypeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});
export const GaugeTypeSchema = ToolsTypeSchema;
export const OtherToolsTypeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  prefixToolsNo: z.string().max(20).optional(),
  poPrefix: z.string().max(20).optional(),
  grnPrefix: z.string().max(20).optional(),
  indentPrefix: z.string().max(20).optional(),
});
export const QmsOtherToolsTypeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  refGroupId: z.number(),
});

// ── GaugeAndTools Master ─────────────────────────────────────────
export const GaugeAndToolsCreateSchema = z.object({
  toolOrGaugeNo: z.string().min(1).max(30),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  size: z.string().max(100).optional(),
  shape: z.string().max(100).optional(),
  grouping: z.string().min(1).max(100),
  type: z.string().max(100).optional(),
  serialNoGenReq: z.boolean().default(false),
  totQty: z.number().int().min(0),
  qtyIn: z.number().int().min(0),
  location: z.string().max(100).optional(),
  deptName: z.string().max(100).optional(),
  status: z
    .enum(["Available", "Issued", "Under Calibration", "Under Repair", "Scrapped"])
    .default("Available"),
  calibrationFrqMonths: z.number().int().min(0).optional(),
  caliPlannedWho: z.string().max(200).optional(),
  supCode: z.string().max(20).optional(),
  specifications: z
    .array(
      z.object({
        specName: z.string().min(1),
        specValue: z.string().optional(),
        unit: z.string().optional(),
      })
    )
    .optional(),
});

// ── Tools Issue ───────────────────────────────────────────────────
export const ToolsIssueCreateSchema = z.object({
  deptName: z.string().min(1).max(100),
  partyName: z.string().min(1).max(200),
  issueDate: z.string().datetime({ offset: true }).or(z.string().date()),
  dueDate: z.string().datetime({ offset: true }).or(z.string().date()),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        qtyIssued: z.number().int().min(1),
      })
    )
    .min(1, "At least one line item is required"),
});

// ── Tools Receive ─────────────────────────────────────────────────
export const ToolsReceiveCreateSchema = z.object({
  dcNo: z.string().min(1),
  receiveDate: z.string().datetime({ offset: true }).or(z.string().date()),
  remarks: z.string().max(500).optional(),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        qtyReturned: z.number().int().min(1),
      })
    )
    .min(1),
});

// ── Consumption ───────────────────────────────────────────────────
export const ConsumptionCreateSchema = z.object({
  dcNo: z.string().min(1),
  toolOrGaugeNo: z.string().min(1),
  worksheetRef: z.string().min(1).max(50),
  qtyConsumed: z.number().int().min(1),
  consumptionDate: z.string().datetime({ offset: true }).or(z.string().date()),
  verifiedBySupervisor: z.boolean().default(false),
});

// ── PO GRN ────────────────────────────────────────────────────────
export const PoReceiveCreateSchema = z.object({
  poRef: z.string().min(1).max(30),
  supCode: z.string().min(1).max(20),
  grnDate: z.string().datetime({ offset: true }).or(z.string().date()),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        poQty: z.number().int().min(1),
        receivedQty: z.number().int().min(1),
        unitRate: z.number().min(0),
      })
    )
    .min(1),
});

// ── PO Schedule ───────────────────────────────────────────────────
export const PoScheduleCreateSchema = z.object({
  poRef: z.string().min(1).max(30),
  supCode: z.string().min(1).max(20),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        expectedDate: z.string().datetime({ offset: true }).or(z.string().date()),
        expectedQty: z.number().int().min(1),
      })
    )
    .min(1),
});

// ── Calibration Issue ─────────────────────────────────────────────
export const CalibIssueCreateSchema = z.object({
  issueType: z.enum(["In-House", "External"]),
  labName: z.string().max(200).optional(),
  issueDate: z.string().datetime({ offset: true }).or(z.string().date()),
  expectedReturnDate: z.string().datetime({ offset: true }).or(z.string().date()),
  toolOrGaugeNos: z
    .array(z.string().min(1))
    .min(1, "Select at least one tool"),
});

// ── Calibration Receive ───────────────────────────────────────────
export const CalibReceiveCreateSchema = z.object({
  calibDcNo: z.string().min(1),
  receiveDate: z.string().datetime({ offset: true }).or(z.string().date()),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        calibrationDate: z.string().datetime({ offset: true }).or(z.string().date()),
        result: z.enum(["Pass", "Fail", "Conditional Pass"]),
        nextCalibDate: z.string().datetime({ offset: true }).or(z.string().date()),
        certificateFileName: z.string().max(200).optional(),
        remarks: z.string().max(1000).optional(),
      })
    )
    .min(1),
});
