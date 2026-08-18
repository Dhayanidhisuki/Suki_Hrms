import { z } from "zod";
import { normalizeCompanyUnit } from "@/lib/companyUnits";

// ── Auth ──────────────────────────────────────────────────────────
export const VerifyTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

/** Standalone Tools Management login (Phase 2+) — username + password. */
export const LoginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(50),
  password: z.string().min(1, "Password is required").max(200),
});

/** Settings → Users (TOOLS_APP_USER) */
export const AppUserCreateSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(150).optional().nullable().or(z.literal("")),
  role: z.string().trim().min(1).max(50),
  erpUserCode: z.string().trim().max(10).optional().nullable(),
});

export const AppUserUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  password: z.string().max(200).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(150).optional().nullable().or(z.literal("")),
  role: z.string().trim().min(1).max(50).optional(),
  erpUserCode: z.string().trim().max(10).optional().nullable(),
  isActive: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.password != null && data.password.length > 0 && data.password.length < 8) {
    ctx.addIssue({
      code: "custom",
      message: "Password must be at least 8 characters",
      path: ["password"],
    });
  }
});

/** Settings → Roles & Permissions matrix updates */
export const RolePermissionsUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        role: z.string().trim().min(1).max(50),
        permissionKey: z.string().trim().min(1).max(50),
        allowed: z.boolean(),
      })
    )
    .min(1, "At least one update is required"),
});

/** Pricing Master — propose a rate change (does not overwrite live RATE). */
export const PricingProposeSchema = z.object({
  rowId: z.coerce.number().int().positive().optional(),
  toolRefNo: z.coerce.number().int().positive().optional(),
  supCode: z.string().trim().max(10).optional().nullable(),
  proposedRate: z.coerce.number().finite().nonnegative(),
  remarks: z.string().trim().max(200).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.rowId == null && data.toolRefNo == null) {
    ctx.addIssue({
      code: "custom",
      message: "rowId or toolRefNo is required",
      path: ["rowId"],
    });
  }
});

export const PricingRejectSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required").max(500),
});

/** Tools → create COMMON_PURCHASE_ORDER (+ lines) */
export const PurchaseOrderCreateSchema = z.object({
  supCode: z.string().trim().min(1).max(10),
  poDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  validTill: z
    .string()
    .datetime({ offset: true })
    .or(z.string().date())
    .optional()
    .nullable(),
  goodsType: z.string().trim().max(50).optional(),
  purchaseType: z.string().trim().max(20).optional(),
  currency: z.string().trim().max(15).optional(),
  remarks: z.string().trim().max(300).optional().nullable(),
  contactName: z.string().trim().max(50).optional().nullable(),
  paymentTerms: z.string().trim().max(150).optional().nullable(),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().trim().min(1).max(25),
        qty: z.coerce.number().positive(),
        rate: z.coerce.number().nonnegative().optional(),
        uom: z.string().trim().max(10).optional(),
        comments: z.string().trim().max(2000).optional().nullable(),
        /** ERP naming — FINANCE_LEDGER_MASTER.CODE */
        expLedgerCode: z.string().trim().max(25).optional().nullable(),
        /** Tools-only free-text budget / cost ref (no ERP BUDGET_CODE on PO) */
        budgetCode: z.string().trim().max(50).optional().nullable(),
      })
    )
    .min(1, "At least one line item is required"),
});

/** Tools-owned payment update on TOOLS_PO_FINANCE */
export const PurchaseOrderFinanceUpdateSchema = z.object({
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]),
  paymentDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().date())
    .optional()
    .nullable(),
  remarks: z.string().trim().max(200).optional().nullable(),
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
  add2: z.string().max(100).optional(),
  gstin: z.string().max(25).optional(),
  approvedSubcontractor: z.string().max(5).optional(),
  status: z.string().max(15).optional(),
});
export const SubcontractorUpdateSchema = SubcontractorCreateSchema.partial().extend({
  subConId: z.string(),
});

// ── Lookup Masters ────────────────────────────────────────────────
export const ToolsTypeSchema = z.object({
  typeOfTools: z.string().min(1).max(100),
  itemGroupId: z.number().int().optional(),
  itemTypeId: z.number().int().optional(),
  isAutoGenCd: z.string().max(3).optional(),
  prefixItemNo: z.string().max(15).optional(),
  // UI aliases
  name: z.string().min(1).max(100).optional(),
  groupId: z.number().int().optional(),
  typeId: z.number().int().optional(),
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
  itemNoPrefixMod: z.string().max(5).optional(),
  prefixGateEntry: z.string().max(12).optional(),
  // UI aliases
  name: z.string().min(1).max(35).optional(),
  code: z.string().max(12).optional(),
});
// Confirmed real columns of QMS_OTHER_TOOLS_TYPE only. ASSET_CATEGORY is
// intentionally excluded: the only stored value in the ERP is the legacy
// placeholder '-Select-', so the field carries no real data.
export const QmsOtherToolsTypeSchema = z.object({
  qmsOtherTypeOfTools: z.string().min(1).max(50),
  refGroupId: z.number(),
  prefixToolsNo: z.string().max(12).optional(),
  isAutoGenCd: z.enum(["Yes", "No"]).optional(),
  prefixBased: z.string().max(10).optional(),
  // UI alias
  name: z.string().min(1).max(50).optional(),
});

// ── GaugeAndTools Master ─────────────────────────────────────────
const yesNo = z.enum(["Yes", "No"]).or(z.string().max(10)).optional();
const yn = z.enum(["Y", "N", "Yes", "No"]).or(z.string().max(5)).optional();

export const GaugeAndToolsCreateSchema = z.object({
  refNo: z.number().int().optional(),
  grouping: z.string().min(1).max(25),
  type: z.string().max(50).optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  toolOrGaugeNo: z.string().min(1).max(25),
  size: z.string().max(25).optional(),
  shape: z.string().max(15).optional(),
  range: z.string().max(30).optional(),
  // ERP allows TOT_QTY=0 for newly registered items that have not been received yet.
  totQty: z.number().min(0),
  qtyIn: z.number().min(0).optional(),
  qtyOut: z.number().min(0).optional(),
  qtyNew: z.number().min(0).optional(),
  qtyInUse: z.number().min(0).optional(),
  location: z.string().max(50).optional(),
  locationName: z.string().min(1).max(100).refine((value) => Boolean(normalizeCompanyUnit(value)), {
    message: "Current Unit must be Unit 1, Unit 2, or Unit 3",
  }),
  locationOutputName: z.string().max(100).optional(),
  area: z.string().max(100).optional(),
  rack: z.string().max(100).optional(),
  deptName: z.string().max(25).optional(),
  issueType: z
    .enum([
      "For Regular",
      "For Asset",
      "For Product",
      "For Employee",
      "For Department",
      "For Trial",
    ])
    .or(z.string().max(25))
    .optional(),
  oldItemNo: z.string().max(20).optional(),
  price: z.number().min(0).optional(),
  minOrderLevel: z.number().min(0).optional(),
  hsnCode: z.string().max(25).optional(),
  drawingNo: z.string().max(30).optional(),
  revNoDt: z.string().max(30).optional(),
  detailedSpec: z.string().optional(),
  packingLength: z.string().max(20).optional(),
  packingWidth: z.string().max(20).optional(),
  packingHeight: z.string().max(20).optional(),
  packingDimensions: z.string().max(50).optional(),
  stiffness: z.string().max(20).optional(),
  selfLife: z.number().int().min(0).optional(),
  activeItem: yesNo,
  criticalItem: yesNo,
  poReq: yesNo,
  stockReq: yesNo,
  stockItem: z.string().max(1).optional(),
  isAsset: yesNo,
  saleableItem: yesNo,
  nocReq: yesNo,
  machineSoftware: yesNo,
  ineligibleForItc: yesNo,
  isCustGiven: yesNo,
  historyCardReq: yesNo,
  // Intentionally optional/nullable — GAUGEANDTOOLS.STATUS is not a lifecycle field.
  status: z.string().max(25).nullable().optional(),
  calibrationFrqMonths: z.number().int().min(0).optional(),
  caliPlannedWho: z.string().max(15).optional(),
  calibrationResponsibility: z.string().max(15).optional(),
  serialNoGenReq: z.union([z.boolean(), yn]).optional(),
  preventiveMethod: z.string().max(25).optional(),
  preventiveFrqMonths: z.number().int().min(0).optional(),
  /** ERP Preventive MNT Done At */
  preventiveFrqOthers: z.number().int().min(0).optional().nullable(),
  /** ERP Ref Details */
  refDetails: z.string().max(50).optional().nullable(),
  /** ERP Addil. Remarks */
  remarks: z.string().max(50).optional().nullable(),
  gSpecUpperMin: z.number().optional(),
  gSpecUpperMax: z.number().optional(),
  wLimitLowerMax: z.number().optional(),
  wLimitUpperMin: z.number().optional(),
  wLimitUpperMax: z.number().optional(),
  prodSpecLowerMax: z.number().optional(),
  prodSpecUpperMin: z.number().optional(),
  prodSpecUpperMax: z.number().optional(),
  uom: z.string().max(10).optional(),
  leastCount: z.string().max(50).optional(),
  companyId: z.string().max(10).optional(),
  returnable: yesNo,
  specifications: z
    .array(
      z.object({
        sequence: z.number().int().min(0).optional(),
        parameter: z.string().min(1).max(50).optional(),
        specification: z.string().max(100).optional(),
        minRange: z.string().max(15).optional(),
        maxRange: z.string().max(15).optional(),
        // ERP Tools Specification dialog (TOOLS_SPECIFICATION)
        wLimitLowerMin: z.number().optional().nullable(),
        wLimitLowerMax: z.number().optional().nullable(),
        prodSpecLowerMin: z.number().optional().nullable(),
        prodSpecLowerMax: z.number().optional().nullable(),
        // legacy UI aliases
        specName: z.string().max(50).optional(),
        specValue: z.string().max(100).optional(),
        unit: z.string().max(15).optional(),
      })
    )
    .optional(),
});

// ── Tools Issue ───────────────────────────────────────────────────
export const ToolsIssueCreateSchema = z
  .object({
    receiveName: z.string().min(1).max(50),
    receiveNameTwo: z.string().max(50).optional(),
    subCode: z.string().max(10).optional(),
    supCode: z.string().max(10).optional(),
    custCode: z.string().max(12).optional(),
    // ERP EMP_ID is NOT NULL; legacy often stores 0 when no employee is linked
    empId: z.coerce.number().int().optional().default(0),
    issueDate: z.string().datetime({ offset: true }).or(z.string().date()),
    dueDate: z.string().datetime({ offset: true }).or(z.string().date()),
    // ERP header fields (GAUGE_TOOLS_ISSUE)
    issueOption: z.string().max(30).optional(), // Search By: SubContractor / Supplier / Customer…
    dcRefNo: z.string().max(20).optional(),
    returnable: z.enum(["Yes", "No"]).or(z.string().max(5)).optional(),
    transportName: z.string().max(50).optional(),
    vehicleNo: z.string().max(25).optional(),
    comments: z.string().max(100).optional(),
    lobType: z.string().min(1).max(50),
    poOrderNo: z.string().max(15).optional(),
    fromUnit: z.string().max(15).optional(),
    itemType: z.string().max(100).optional(),
    issuePurpose: z.string().max(100).optional(),
    matType: z.string().max(20).optional(),
    /** ERP: issue against Requisition Pending for Tools? */
    requisitionPending: z.enum(["Yes", "No"]).optional().default("No"),
    /** MATERIAL_REQUISITION_MASTER.REQ_NO when requisitionPending = Yes */
    reqNo: z.string().max(40).optional(),
    lines: z
      .array(
        z.object({
          toolOrGaugeNo: z.string().min(1),
          issueQty: z.number().min(1),
          // Optional on wire — API defaults to toolOrGaugeNo (PART_NO is NOT NULL in ERP)
          partNo: z.string().min(1).max(50).optional(),
          machine: z.string().max(50).optional(),
          processName: z.string().max(100).optional(),
          remarks: z.string().max(100).optional(),
          serialNo: z.number().int().optional(),
          returnable: z.enum(["Yes", "No"]).or(z.string().max(5)).optional(),
          price: z.number().min(0).optional(),
          /** Internal unit transfer destination (stored in ERP ISSUE_TO_ITEM_NO). */
          toUnit: z.string().max(15).optional(),
        })
      )
      .min(1, "At least one line item is required"),
  })
  .superRefine((data, ctx) => {
    const opt = (data.issueOption ?? "").toLowerCase();
    if (opt === "customer" && !(data.custCode ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "custCode is required when issueOption is Customer",
        path: ["custCode"],
      });
    }
    if (data.requisitionPending === "Yes" && !(data.reqNo ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reqNo is required when Requisition Pending = Yes",
        path: ["reqNo"],
      });
    }
    const isInternalMovement = opt === "internal unit movement" || opt === "internal movement";
    const isMovement = isInternalMovement || opt.startsWith("external:");
    if (isInternalMovement && !(data.fromUnit ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source unit is required for an internal tool issue",
        path: ["fromUnit"],
      });
    }
    if (isInternalMovement && !normalizeCompanyUnit(data.fromUnit)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source unit must be Unit 1, Unit 2, or Unit 3",
        path: ["fromUnit"],
      });
    }
    data.lines.forEach((line, index) => {
      if (isMovement && line.issueQty !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each instrument movement quantity must be exactly 1",
          path: ["lines", index, "issueQty"],
        });
      }
      if (isInternalMovement && !(line.toUnit ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination unit is required",
          path: ["lines", index, "toUnit"],
        });
      }
      if (isInternalMovement && !normalizeCompanyUnit(line.toUnit)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination unit must be Unit 1, Unit 2, or Unit 3",
          path: ["lines", index, "toUnit"],
        });
      }
      if (isInternalMovement && (line.toUnit ?? "").trim() === (data.fromUnit ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination unit must be different from source unit",
          path: ["lines", index, "toUnit"],
        });
      }
    });
  });

export const ToolsIssueUpdateSchema = z.object({
  receiveName: z.string().min(1).max(50).optional(),
  receiveNameTwo: z.string().max(50).optional().nullable(),
  subCode: z.string().max(10).optional().nullable(),
  supCode: z.string().max(10).optional().nullable(),
  custCode: z.string().max(12).optional().nullable(),
  empId: z.coerce.number().int().optional(),
  dueDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  issueOption: z.string().max(30).optional(),
  dcRefNo: z.string().max(20).optional().nullable(),
  returnable: z.enum(["Yes", "No"]).or(z.string().max(5)).optional(),
  transportName: z.string().max(50).optional().nullable(),
  vehicleNo: z.string().max(25).optional().nullable(),
  comments: z.string().max(100).optional().nullable(),
  lobType: z.string().min(1).max(50).optional(),
  poOrderNo: z.string().max(15).optional().nullable(),
  fromUnit: z.string().max(15).optional().nullable(),
  itemType: z.string().max(100).optional().nullable(),
  issuePurpose: z.string().max(100).optional().nullable(),
  matType: z.string().max(20).optional().nullable(),
  lines: z
    .array(
      z.object({
        rowId: z.number().int().positive(),
        remarks: z.string().max(100).optional().nullable(),
        machine: z.string().max(50).optional().nullable(),
        processName: z.string().max(100).optional().nullable(),
      })
    )
    .optional(),
});

// ── Tools Receive ─────────────────────────────────────────────────
export const ToolsReceiveCreateSchema = z.object({
  dcNo: z.string().min(1),
  receiveDate: z.string().datetime({ offset: true }).or(z.string().date()),
  // Optional — API falls back to issue header SUB_CODE or "GENERAL"
  subCode: z.string().max(10).optional(),
  partyDcNo: z.string().max(15).optional(),
  contName: z.string().max(80).optional(), // From Whom / contact
  vendorType: z.string().max(50).optional(),
  poOrderNo: z.string().max(15).optional(),
  location: z.string().max(50).optional(),
  geNo: z.string().max(20).optional(),
  geDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  invoiceNo: z.string().max(25).optional(),
  remarks: z.string().max(30).optional(),
  lines: z
    .array(
      z.object({
        // Prefer issue line ROW_ID — legacy ERP lines often have null TOOL_OR_GAUGE_NO
        issueRowId: z.number().int().positive(),
        toolOrGaugeNo: z.string().min(1).max(25).optional(),
        quantity: z.number().min(0.001),
        status: z.string().max(30).optional(),
        comments: z.string().max(30).optional(),
        /** May differ per partially received line; defaults to the issued-to unit. */
        destinationUnit: z.string().max(100).optional(),
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
        toolOrGaugeNo: z.string().min(1),
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
  toolsPoNo: z.string().max(20).optional(),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        issueQty: z.number().int().min(1),
        serialNo: z.number().int().optional(),
        calibDueDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
      })
    )
    .min(1, "Select at least one tool"),
});

export const CalibIssueUpdateSchema = z.object({
  receiveName: z.string().max(25).optional().nullable(),
  subCode: z.string().max(10).optional().nullable(),
  issueDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  issueFor: z.string().max(25).optional(),
  toolsPoNo: z.string().max(20).optional().nullable(),
});

// ── Calibration Results Update ───────────────────────────────────
// ERP-aligned statuses + legacy PASSED/FAILED kept for existing data.
export const CALIB_RESULT_STATUSES = [
  "AVAILABLE FOR USE",
  "PASSED",
  "FAILED",
  "WORN OUT",
  "BROKEN",
  "REJECTED",
  "NOT IN USE",
  "OUT OF SERVICE",
  "RECALIBRATED",
] as const;

export const CalibResultsUpdateSchema = z.object({
  toolOrGaugeNo: z.string().min(1),
  result: z.enum(CALIB_RESULT_STATUSES),
  remarks: z.string().max(500).optional(),
  nextCDate: z.string().datetime({ offset: true }).or(z.string().date()),
  calibratedDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  calibratedBy: z.string().max(25).optional(),
  certificateNo: z.string().max(50).optional(),
  referenceStandard: z.string().max(100).optional(),
  errorNoticed: z.string().max(100).optional(),
  comments: z.string().max(200).optional(),
  location: z.string().max(50).optional(),
  locationName: z.string().max(100).optional(),
  /** UI-only observed specs packed into short ERP text cols (OTHERS table not in app Prisma). */
  observedSpecs: z
    .array(
      z.object({
        parameter: z.string().max(50),
        specification: z.string().max(200).optional(),
        obsMin: z.string().max(20).optional(),
        obsMax: z.string().max(20).optional(),
        gaugeStatus: z.string().max(30).optional(),
        note: z.string().max(40).optional(),
      })
    )
    .optional(),
});

// ── Calibration Receive ───────────────────────────────────────────
export const CalibReceiveCreateSchema = z.object({
  dcNo: z.number().int().min(1),
  receiveDate: z.string().datetime({ offset: true }).or(z.string().date()),
  partyDcNo: z.string().max(20).optional(),
  receiverName: z.string().max(30).optional(),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1),
        /** Must be at least 1 — zero-qty receive is not allowed */
        qty: z.number().min(1, "Quantity must be at least 1"),
        price: z.number().min(0),
        serialNo: z.number().int().optional().nullable(),
        description: z.string().max(50).optional().nullable(),
      })
    )
    .min(1),
});

/** Raise Material Requisition (tools) — writes MATERIAL_REQUISITION_* */
export const MaterialRequisitionCreateSchema = z.object({
  reqDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  deptId: z.coerce.number().int().optional().nullable(),
  empCd: z.coerce.number().int().optional().nullable(),
  matType: z.string().max(20).optional().default("TOOLS"),
  fromWhere: z.string().max(30).optional(),
  remarks: z.string().max(500).optional(),
  lines: z
    .array(
      z.object({
        toolOrGaugeNo: z.string().min(1).max(30),
        reqQty: z.number().min(0.001),
        uom: z.string().max(20).optional(),
        machine: z.string().max(20).optional(),
        description: z.string().max(500).optional(),
        remarks: z.string().max(500).optional(),
      })
    )
    .min(1, "At least one tool line is required"),
});
