import { z } from "zod";

// ── Auth ──────────────────────────────────────────────────────────
export const VerifyTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// ── Supplier ─────────────────────────────────────────────────────
export const SupplierCreateSchema = z.object({
  supCode: z.string().min(1).max(10),
  supName: z.string().min(1).max(200),
  add1: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(50).optional(),
  gstin: z.string().max(25).optional(),
  phone1: z.string().max(30).optional(),
  emailId: z.string().email().optional().or(z.literal("")),
  bankName: z.string().max(50).optional(),
  accountNumber: z.string().max(30).optional(),
  ifscCode: z.string().max(30).optional(),
  approvedSupplier: z.string().max(5).optional(),
  status: z.string().max(15).optional(),
});
export const SupplierUpdateSchema = SupplierCreateSchema.partial().extend({
  supCode: z.string(),
});

// ── Subcontractor ─────────────────────────────────────────────────
export const SubcontractorCreateSchema = z.object({
  subConId: z.string().min(1).max(10),
  subName: z.string().min(1).max(150),
  natureOfWork: z.string().max(50).optional(),
  isStoreVendor: z.string().max(3).optional(),
  isInhouse: z.string().max(3).optional(),
  isIssueDc: z.string().max(3).optional(),
  add1: z.string().max(75).optional(),
  gstin: z.string().max(25).optional(),
  status: z.string().max(15).optional(),
});

// ── Lookup Masters ────────────────────────────────────────────────
export const ToolsTypeSchema = z.object({
  typeOfTools: z.string().min(1).max(100),
  isAutoGenCd: z.string().max(3).optional(),
  prefixItemNo: z.string().max(15).optional(),
});
export const GaugeTypeSchema = z.object({
  typeOfGauge: z.string().min(1).max(25),
});
export const OtherToolsTypeSchema = z.object({
  otherType: z.string().min(1).max(35),
  serialNoGenReq: z.string().max(5).optional(),
  issueType: z.string().max(25).optional(),
  poPrefix: z.string().max(20).optional(),
  indentPrefix: z.string().max(12).optional(),
  grnPrefix: z.string().max(12).optional(),
  prefixToolsNo: z.string().max(12).optional(),
});
export const QmsOtherToolsTypeSchema = z.object({
  qmsOtherTypeOfTools: z.string().min(1).max(50),
  refGroupId: z.number(),
  prefixToolsNo: z.string().max(12).optional(),
  isAutoGenCd: z.string().max(5).optional(),
});

// ── GaugeAndTools Master ─────────────────────────────────────────
export const GaugeAndToolsCreateSchema = z.object({
  refNo: z.number().int(),
  grouping: z.string().min(1).max(25),
  type: z.string().max(50).optional(),
  name: z.string().min(1).max(100),
  des: z.string().max(500).optional(),
  toolOrGaugeNo: z.string().min(1).max(25),
  size: z.string().max(25).optional(),
  shape: z.string().max(15).optional(),
  totQty: z.number().min(0),
  qtyIn: z.number().min(0),
  location: z.string().max(50).optional(),
  deptName: z.string().max(25).optional(),
  status: z.string().max(25).optional(),
  calibrationFrqMonths: z.number().int().min(0).optional(),
  caliPlannedWho: z.string().max(15).optional(),
  serialNoGenReq: z.string().max(5).optional(),
  uom: z.string().max(10).optional(),
  returnable: z.string().max(3).optional(),
  specifications: z
    .array(
      z.object({
        parameter: z.string().min(1).max(50),
        specification: z.string().max(100).optional(),
        minRange: z.string().max(15).optional(),
        maxRange: z.string().max(15).optional(),
      })
    )
    .optional(),
});

// ── Tools Issue ───────────────────────────────────────────────────
export const ToolsIssueCreateSchema = z.object({
  receiveName: z.string().min(1).max(50),
  subCode: z.string().max(10).optional(),
  empId: z.number().int(),
  issueDate: z.string().datetime({ offset: true }).or(z.string().date()),
  dueDate: z.string().datetime({ offset: true }).or(z.string().date()),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        issueQty: z.number().min(1),
        partNo: z.string().min(1).max(50),
      })
    )
    .min(1, "At least one line item is required"),
});

// ── Tools Receive ─────────────────────────────────────────────────
export const ToolsReceiveCreateSchema = z.object({
  dcNo: z.string().min(1),
  receiveDate: z.string().datetime({ offset: true }).or(z.string().date()),
  subCode: z.string().min(1).max(10),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        quantity: z.number().min(1),
      })
    )
    .min(1),
});

// ── Consumption ───────────────────────────────────────────────────
export const ConsumptionCreateSchema = z.object({
  dcNo: z.string().min(1),
  toolOrGaugeNo: z.string().min(1),
  worksheetRef: z.string().min(1),
  qtyConsumed: z.number().min(1),
  consumptionDate: z.string().optional(),
  verifiedBySupervisor: z.boolean().optional(),
});

// ── PO GRN ────────────────────────────────────────────────────────
export const PoReceiveCreateSchema = z.object({
  poOrderNo: z.string().min(1).max(16),
  supCode: z.string().min(1).max(10),
  girDate: z.string().datetime({ offset: true }).or(z.string().date()),
  lines: z
    .array(
      z.object({
        itemCode: z.string().min(1).max(25),
        invQty: z.number().min(0),
        recQty: z.number().min(1),
        price: z.number().min(0),
      })
    )
    .min(1),
});

// ── PO Schedule ───────────────────────────────────────────────────
export const PoScheduleCreateSchema = z.object({
  poOrderNo: z.string().min(1).max(50),
  lines: z
    .array(
      z.object({
        poTransNo: z.number().int().min(1),
        qty: z.number().min(1),
      })
    )
    .min(1),
});

// ── Calibration Frequency Master ──────────────────────────────────
export const CalibFrequencyMasterSchema = z.object({
  prodToleranceMin: z.string().max(50).optional(),
  prodToleranceMax: z.number().optional(),
  calibFrequency: z.number().int().min(0).optional(),
});

// ── Calibration Issue ─────────────────────────────────────────────
export const CalibIssueCreateSchema = z.object({
  receiveName: z.string().max(25).optional(),
  subCode: z.string().max(10).optional(),
  issueDate: z.string().datetime({ offset: true }).or(z.string().date()),
  issueFor: z.string().max(25).optional(),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        issueQty: z.number().int().min(1),
      })
    )
    .min(1, "Select at least one tool"),
});

// ── Calibration Receive ───────────────────────────────────────────
export const CalibReceiveCreateSchema = z.object({
  dcNo: z.number().int().min(1),
  receiveDate: z.string().datetime({ offset: true }).or(z.string().date()),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        qty: z.number().min(0),
        price: z.number().min(0),
      })
    )
    .min(1),
});
