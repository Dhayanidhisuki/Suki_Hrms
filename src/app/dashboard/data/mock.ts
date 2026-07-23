// ─── Schema-Aligned Mock Data — SUKI ERP Tools Management Dashboard ────────
// Derived from schema.prisma (GaugeAndTools, GaugeToolsIssue, ErpUser)
// Scaled to realistic volume (~130 tools, ~38 open issues)

// ── Sample Logged-in ErpUser ──────────────────────────────────────────────
export const sampleUser = {
  userId: "U0001",
  name: "System Admin",
  email: "admin@sukierp.com",
};

// ── KPI Stats ─────────────────────────────────────────────────────────────
// Total tools: 134 | Currently Issued: 38 | Calibration Due: 14 | Under Repair/Cal: 8
export const kpiStats = {
  totalTools: 134,
  currentlyIssued: 38,
  calibrationDue: 14, // due within 7/30 days based on calibrationFrqMonths
  underRepairOrCalibration: 8, // status = "Under Repair" (5) + "Under Calibration" (3)
};

// ── Tools By Group (GaugeAndTools.grouping) ────────────────────────────────
// Scaled from seed sample ("Measuring Equip") and standard tool groupings
export const toolsByGroup = [
  { name: "Measuring Equip", count: 48, color: "#2563eb" },
  { name: "Hand Tools", count: 35, color: "#3b82f6" },
  { name: "Power Tools", count: 24, color: "#60a5fa" },
  { name: "Gauges", count: 17, color: "#93c5fd" },
  { name: "Inspection Equip", count: 10, color: "#bfdbfe" },
];

// ── Tools Issue Activity (GaugeToolsIssue) ─────────────────────────────────
// Columns: empId ("Employee #245"), toolOrGaugeNo, issueDate, dueDate, status
export type ActivityStatus = "Issued" | "Received" | "Overdue";

export interface ActivityRow {
  id: string;
  empId: string;
  empDisplay: string;
  toolOrGaugeNo: string;
  toolName: string;
  issueDate: string;
  dueDate: string;
  status: ActivityStatus;
}

export const activityFeed: ActivityRow[] = [
  {
    id: "ISS-001",
    empId: "EMP-245",
    empDisplay: "Employee #245",
    toolOrGaugeNo: "TL-MIC-001",
    toolName: "Outside Micrometer 0-25mm",
    issueDate: "2026-07-21",
    dueDate: "2026-07-28",
    status: "Issued",
  },
  {
    id: "ISS-002",
    empId: "EMP-108",
    empDisplay: "Employee #108",
    toolOrGaugeNo: "TL-CAL-014",
    toolName: "Digital Vernier Caliper 150mm",
    issueDate: "2026-07-15",
    dueDate: "2026-07-20",
    status: "Overdue",
  },
  {
    id: "ISS-003",
    empId: "EMP-312",
    empDisplay: "Employee #312",
    toolOrGaugeNo: "TL-TRQ-005",
    toolName: "Adjustable Torque Wrench 10-50Nm",
    issueDate: "2026-07-19",
    dueDate: "2026-07-26",
    status: "Received",
  },
  {
    id: "ISS-004",
    empId: "EMP-092",
    empDisplay: "Employee #092",
    toolOrGaugeNo: "TL-DMM-009",
    toolName: "Digital Multimeter CAT III",
    issueDate: "2026-07-20",
    dueDate: "2026-07-27",
    status: "Issued",
  },
  {
    id: "ISS-005",
    empId: "EMP-174",
    empDisplay: "Employee #174",
    toolOrGaugeNo: "TL-GAG-022",
    toolName: "Thread Plug Gauge M12x1.75",
    issueDate: "2026-07-12",
    dueDate: "2026-07-18",
    status: "Overdue",
  },
  {
    id: "ISS-006",
    empId: "EMP-405",
    empDisplay: "Employee #405",
    toolOrGaugeNo: "TL-IND-003",
    toolName: "Dial Indicator 0.01mm",
    issueDate: "2026-07-18",
    dueDate: "2026-07-25",
    status: "Received",
  },
  {
    id: "ISS-007",
    empId: "EMP-219",
    empDisplay: "Employee #219",
    toolOrGaugeNo: "TL-BOR-002",
    toolName: "Bore Gauge 50-160mm",
    issueDate: "2026-07-21",
    dueDate: "2026-07-28",
    status: "Issued",
  },
  {
    id: "ISS-008",
    empId: "EMP-056",
    empDisplay: "Employee #056",
    toolOrGaugeNo: "TL-HG-007",
    toolName: "Digital Height Gauge 300mm",
    issueDate: "2026-07-14",
    dueDate: "2026-07-21",
    status: "Received",
  },
];

// ── Tool Status Donut (GaugeAndTools.status) ────────────────────────────────
// Driven strictly by GaugeAndTools.status values seeded/schema-supported
export const toolStatusData = [
  { name: "Available", value: 88, color: "#22c55e" },
  { name: "Issued", value: 38, color: "#3b82f6" },
  { name: "Under Calibration", value: 5, color: "#f59e0b" },
  { name: "Under Repair", value: 3, color: "#ef4444" },
];

// ═══════════════════════════════════════════════════════════════════
// EXTENSION BLOCK — appended for module screens
// ═══════════════════════════════════════════════════════════════════

// ── Supplier Master (SUPPLIER table) ─────────────────────────────
export interface Supplier {
  id: string;
  supCode: string;
  supName: string;
  address: string;
  city: string;
  state: string;
  gstin: string;
  phone: string;
  email: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  isApproved: boolean;
  status: "Active" | "Inactive";
  creatUserId: string;
  creatDt: string;
}

export const suppliersMock: Supplier[] = [
  { id: "SUP-001", supCode: "S001", supName: "Mitutoyo India Pvt Ltd", address: "Plot 45, MIDC", city: "Pune", state: "Maharashtra", gstin: "27AABCM1234F1ZX", phone: "9820001122", email: "sales@mitutoyo.in", bankName: "HDFC Bank", accountNo: "00112233445566", ifscCode: "HDFC0001234", isApproved: true, status: "Active", creatUserId: "U0001", creatDt: "2025-01-15" },
  { id: "SUP-002", supCode: "S002", supName: "Starrett Tools Distributors", address: "12 Industrial Estate", city: "Chennai", state: "Tamil Nadu", gstin: "33AABCS9988G1ZY", phone: "9445667788", email: "orders@starrett.co.in", bankName: "ICICI Bank", accountNo: "11223344556677", ifscCode: "ICIC0004567", isApproved: true, status: "Active", creatUserId: "U0001", creatDt: "2025-02-10" },
  { id: "SUP-003", supCode: "S003", supName: "Kaeser Compressors", address: "Survey No 78, Phase II", city: "Ahmedabad", state: "Gujarat", gstin: "24AAACK0023H1ZA", phone: "9712334455", email: "support@kaeser.in", bankName: "Axis Bank", accountNo: "22334455667788", ifscCode: "UTIB0002211", isApproved: false, status: "Active", creatUserId: "U0003", creatDt: "2025-03-22" },
  { id: "SUP-000035", supCode: "SUP-000035", supName: "Unknown Supplier", address: "-", city: "-", state: "-", gstin: "-", phone: "-", email: "-", bankName: "-", accountNo: "-", ifscCode: "-", isApproved: false, status: "Inactive", creatUserId: "SYSTEM", creatDt: "2024-01-01" },
];

// ── Subcontractor Master (SUBCONTRACTOR table) ────────────────────
export interface Subcontractor {
  id: string;
  subCode: string;
  subName: string;
  natureOfWork: string;
  isStoreVendor: boolean;
  isInhouse: boolean;
  isIssueDC: boolean;
  address: string;
  gstin: string;
  status: "Active" | "Inactive";
  creatUserId: string;
  creatDt: string;
}

export const subcontractorsMock: Subcontractor[] = [
  { id: "SUB-001", subCode: "SC001", subName: "Reliable Calibration Lab", natureOfWork: "Calibration Services", isStoreVendor: false, isInhouse: false, isIssueDC: true, address: "G-12, Andheri East", gstin: "27AABCR5678J1ZB", status: "Active", creatUserId: "U0001", creatDt: "2025-01-20" },
  { id: "SUB-002", subCode: "SC002", subName: "InHouse Repair Unit", natureOfWork: "Tool Repair & Maintenance", isStoreVendor: true, isInhouse: true, isIssueDC: false, address: "Plant Floor B, Esskay Works", gstin: "N/A", status: "Active", creatUserId: "U0001", creatDt: "2025-02-05" },
];

// ── Lookup Masters ────────────────────────────────────────────────
export interface ToolType { id: string; code: string; name: string; description: string; }
export interface GaugeType { id: string; code: string; name: string; description: string; }
export interface ToolsGroup { id: string; code: string; name: string; prefixToolsNo: string; poPrefix: string; grnPrefix: string; indentPrefix: string; }
export interface ToolsSubgroup { id: string; code: string; name: string; refGroupId: string; refGroupName: string; }

export const toolTypesMock: ToolType[] = [
  { id: "TT-01", code: "TT01", name: "Measuring Instrument", description: "Precision measuring devices" },
  { id: "TT-02", code: "TT02", name: "Hand Tool", description: "Manual hand tools" },
  { id: "TT-03", code: "TT03", name: "Power Tool", description: "Electrically powered tools" },
  { id: "TT-04", code: "TT04", name: "Gauge", description: "Go/No-Go and plug gauges" },
];

export const gaugeTypesMock: GaugeType[] = [
  { id: "GT-01", code: "GT01", name: "Thread Gauge", description: "Thread plug & ring gauges" },
  { id: "GT-02", code: "GT02", name: "Plain Gauge", description: "Plain bore and shaft gauges" },
  { id: "GT-03", code: "GT03", name: "Profile Gauge", description: "Profile and form gauges" },
];

export const toolsGroupsMock: ToolsGroup[] = [
  { id: "GRP-01", code: "MEQ", name: "Measuring Equip", prefixToolsNo: "TL-MIC", poPrefix: "PO-MEQ", grnPrefix: "GRN-MEQ", indentPrefix: "IND-MEQ" },
  { id: "GRP-02", code: "HND", name: "Hand Tools", prefixToolsNo: "TL-HND", poPrefix: "PO-HND", grnPrefix: "GRN-HND", indentPrefix: "IND-HND" },
  { id: "GRP-03", code: "PWR", name: "Power Tools", prefixToolsNo: "TL-PWR", poPrefix: "PO-PWR", grnPrefix: "GRN-PWR", indentPrefix: "IND-PWR" },
  { id: "GRP-04", code: "GAG", name: "Gauges", prefixToolsNo: "TL-GAG", poPrefix: "PO-GAG", grnPrefix: "GRN-GAG", indentPrefix: "IND-GAG" },
];

export const toolsSubgroupsMock: ToolsSubgroup[] = [
  { id: "SG-01", code: "MIC", name: "Micrometers", refGroupId: "GRP-01", refGroupName: "Measuring Equip" },
  { id: "SG-02", code: "CAL", name: "Calipers", refGroupId: "GRP-01", refGroupName: "Measuring Equip" },
  { id: "SG-03", code: "IND", name: "Indicators", refGroupId: "GRP-01", refGroupName: "Measuring Equip" },
  { id: "SG-04", code: "TRQ", name: "Torque Tools", refGroupId: "GRP-02", refGroupName: "Hand Tools" },
  { id: "SG-05", code: "DRL", name: "Drills", refGroupId: "GRP-03", refGroupName: "Power Tools" },
  { id: "SG-06", code: "PLG", name: "Plug Gauges", refGroupId: "GRP-04", refGroupName: "Gauges" },
];

// ── GAUGEANDTOOLS Master ──────────────────────────────────────────
export type ToolStatus = "Available" | "Issued" | "Under Calibration" | "Under Repair" | "Scrapped";

export interface GaugeAndTool {
  id: string;
  toolOrGaugeNo: string;
  name: string;
  description: string;
  size: string;
  shape: string;
  grouping: string; // refs ToolsGroup.name
  type: string; // refs ToolsSubgroup.name
  serialNoGenReq: boolean;
  totQty: number;
  qtyIn: number;
  qtyOut: number;
  qtyNew: number;
  location: string;
  deptName: string;
  status: ToolStatus;
  calibrationFrqMonths: number;
  caliPlannedWho: string;
  lastCalibrationDate: string | null;
  nextCalibrationDate: string | null;
  supCode: string;
  creatUserIdCd: string;
  lstUpdtUserIdCd: string;
  creatDt: string;
}

export const gaugeAndToolsMock: GaugeAndTool[] = [
  { id: "GT-001", toolOrGaugeNo: "TL-MIC-001", name: "Outside Micrometer 0-25mm", description: "Screw-type micrometer for OD measurement", size: "0-25mm", shape: "Cylindrical", grouping: "Measuring Equip", type: "Micrometers", serialNoGenReq: true, totQty: 5, qtyIn: 3, qtyOut: 2, qtyNew: 0, location: "Tool Crib A", deptName: "QC", status: "Available", calibrationFrqMonths: 6, caliPlannedWho: "Reliable Calibration Lab", lastCalibrationDate: "2026-01-15", nextCalibrationDate: "2026-07-15", supCode: "S001", creatUserIdCd: "U0001", lstUpdtUserIdCd: "U0001", creatDt: "2025-01-01" },
  { id: "GT-002", toolOrGaugeNo: "TL-CAL-014", name: "Digital Vernier Caliper 150mm", description: "Digital electronic caliper", size: "0-150mm", shape: "Flat", grouping: "Measuring Equip", type: "Calipers", serialNoGenReq: true, totQty: 10, qtyIn: 6, qtyOut: 4, qtyNew: 2, location: "Tool Crib A", deptName: "Production", status: "Available", calibrationFrqMonths: 12, caliPlannedWho: "InHouse Repair Unit", lastCalibrationDate: "2025-07-01", nextCalibrationDate: "2026-07-01", supCode: "S001", creatUserIdCd: "U0001", lstUpdtUserIdCd: "U0002", creatDt: "2025-01-15" },
  { id: "GT-003", toolOrGaugeNo: "TL-TRQ-005", name: "Adjustable Torque Wrench 10-50Nm", description: "Click-type torque wrench for assembly", size: "10-50Nm", shape: "T-Handle", grouping: "Hand Tools", type: "Torque Tools", serialNoGenReq: false, totQty: 3, qtyIn: 3, qtyOut: 0, qtyNew: 0, location: "Tool Crib B", deptName: "Assembly", status: "Available", calibrationFrqMonths: 12, caliPlannedWho: "Reliable Calibration Lab", lastCalibrationDate: "2025-12-01", nextCalibrationDate: "2026-12-01", supCode: "S002", creatUserIdCd: "U0001", lstUpdtUserIdCd: "U0001", creatDt: "2025-02-01" },
  { id: "GT-004", toolOrGaugeNo: "TL-GAG-022", name: "Thread Plug Gauge M12x1.75", description: "Go/NoGo thread plug gauge metric", size: "M12x1.75", shape: "Cylindrical", grouping: "Gauges", type: "Plug Gauges", serialNoGenReq: true, totQty: 2, qtyIn: 0, qtyOut: 2, qtyNew: 0, location: "Inspection Room", deptName: "QC", status: "Issued", calibrationFrqMonths: 6, caliPlannedWho: "Reliable Calibration Lab", lastCalibrationDate: "2026-02-01", nextCalibrationDate: "2026-08-01", supCode: "S002", creatUserIdCd: "U0001", lstUpdtUserIdCd: "U0001", creatDt: "2025-03-01" },
  { id: "GT-005", toolOrGaugeNo: "TL-IND-003", name: "Dial Indicator 0.01mm", description: "Plunger-type dial indicator", size: "0-10mm", shape: "Round", grouping: "Measuring Equip", type: "Indicators", serialNoGenReq: false, totQty: 4, qtyIn: 4, qtyOut: 0, qtyNew: 0, location: "Tool Crib A", deptName: "QC", status: "Under Calibration", calibrationFrqMonths: 3, caliPlannedWho: "Reliable Calibration Lab", lastCalibrationDate: "2026-04-15", nextCalibrationDate: "2026-07-15", supCode: "S001", creatUserIdCd: "U0001", lstUpdtUserIdCd: "U0001", creatDt: "2025-04-01" },
  { id: "GT-006", toolOrGaugeNo: "TL-BOR-002", name: "Bore Gauge 50-160mm", description: "Telescoping bore gauge set", size: "50-160mm", shape: "T-Handle", grouping: "Measuring Equip", type: "Indicators", serialNoGenReq: true, totQty: 2, qtyIn: 1, qtyOut: 1, qtyNew: 0, location: "Tool Crib A", deptName: "Machining", status: "Available", calibrationFrqMonths: 6, caliPlannedWho: "Reliable Calibration Lab", lastCalibrationDate: "2026-01-10", nextCalibrationDate: "2026-07-10", supCode: "S001", creatUserIdCd: "U0001", lstUpdtUserIdCd: "U0001", creatDt: "2025-05-01" },
  { id: "GT-007", toolOrGaugeNo: "TL-HG-007", name: "Digital Height Gauge 300mm", description: "Electronic height measurement gauge", size: "0-300mm", shape: "Upright", grouping: "Measuring Equip", type: "Indicators", serialNoGenReq: false, totQty: 1, qtyIn: 1, qtyOut: 0, qtyNew: 0, location: "Inspection Room", deptName: "QC", status: "Available", calibrationFrqMonths: 12, caliPlannedWho: "InHouse Repair Unit", lastCalibrationDate: "2026-01-01", nextCalibrationDate: "2027-01-01", supCode: "S001", creatUserIdCd: "U0001", lstUpdtUserIdCd: "U0001", creatDt: "2025-06-01" },
];

// ── Serial Numbers (GAUGE_SERIAL_NO) ─────────────────────────────
export interface GaugeSerialNo {
  id: string;
  toolOrGaugeNo: string; // FK → GaugeAndTool.toolOrGaugeNo
  serialNo: string;
  status: "Available" | "Issued" | "Under Calibration" | "Scrapped";
}

export const gaugeSerialNosMock: GaugeSerialNo[] = [
  { id: "SN-001", toolOrGaugeNo: "TL-MIC-001", serialNo: "TL-MIC-001-001", status: "Issued" },
  { id: "SN-002", toolOrGaugeNo: "TL-MIC-001", serialNo: "TL-MIC-001-002", status: "Available" },
  { id: "SN-003", toolOrGaugeNo: "TL-MIC-001", serialNo: "TL-MIC-001-003", status: "Issued" },
  { id: "SN-004", toolOrGaugeNo: "TL-MIC-001", serialNo: "TL-MIC-001-004", status: "Available" },
  { id: "SN-005", toolOrGaugeNo: "TL-MIC-001", serialNo: "TL-MIC-001-005", status: "Available" },
  { id: "SN-006", toolOrGaugeNo: "TL-CAL-014", serialNo: "TL-CAL-014-001", status: "Issued" },
  { id: "SN-007", toolOrGaugeNo: "TL-CAL-014", serialNo: "TL-CAL-014-002", status: "Available" },
];

// ── Tools Issue Header (GAUGE_TOOLS_ISSUE) ────────────────────────
export type IssueStatus = "OPEN" | "CLOSED" | "PARTIAL";

export interface ToolsIssueHeader {
  id: string;
  dcNo: string;
  deptName: string;
  partyName: string;
  issueDate: string;
  dueDate: string;
  status: IssueStatus;
  creatUserIdCd: string;
  creatDt: string;
  lines: ToolsIssueLine[];
}

export interface ToolsIssueLine {
  id: string;
  dcNo: string;
  toolOrGaugeNo: string;
  toolName: string;
  qtyIssued: number;
  qtyReturned: number;
  remainingQty: number;
  status: "Open" | "Returned";
}

export let issuesMock: ToolsIssueHeader[] = [
  {
    id: "IS-001", dcNo: "DC-2026-001", deptName: "QC", partyName: "QC Team", issueDate: "2026-07-21", dueDate: "2026-07-28", status: "OPEN", creatUserIdCd: "U0001", creatDt: "2026-07-21",
    lines: [
      { id: "ISL-001", dcNo: "DC-2026-001", toolOrGaugeNo: "TL-MIC-001", toolName: "Outside Micrometer 0-25mm", qtyIssued: 2, qtyReturned: 0, remainingQty: 2, status: "Open" },
    ]
  },
  {
    id: "IS-002", dcNo: "DC-2026-002", deptName: "Production", partyName: "Machining Dept", issueDate: "2026-07-15", dueDate: "2026-07-20", status: "OPEN", creatUserIdCd: "U0002", creatDt: "2026-07-15",
    lines: [
      { id: "ISL-002", dcNo: "DC-2026-002", toolOrGaugeNo: "TL-CAL-014", toolName: "Digital Vernier Caliper 150mm", qtyIssued: 3, qtyReturned: 1, remainingQty: 2, status: "Open" },
      { id: "ISL-003", dcNo: "DC-2026-002", toolOrGaugeNo: "TL-GAG-022", toolName: "Thread Plug Gauge M12x1.75", qtyIssued: 2, qtyReturned: 2, remainingQty: 0, status: "Returned" },
    ]
  },
  {
    id: "IS-003", dcNo: "DC-2026-003", deptName: "Assembly", partyName: "Assembly Line 1", issueDate: "2026-07-19", dueDate: "2026-07-26", status: "CLOSED", creatUserIdCd: "U0001", creatDt: "2026-07-19",
    lines: [
      { id: "ISL-004", dcNo: "DC-2026-003", toolOrGaugeNo: "TL-TRQ-005", toolName: "Adjustable Torque Wrench 10-50Nm", qtyIssued: 1, qtyReturned: 1, remainingQty: 0, status: "Returned" },
    ]
  },
];

// ── Tools Consumption (TOOLS_CONSUMPTION_TRANS_ISSUE) ─────────────
export interface ToolConsumption {
  id: string;
  dcNo: string;
  toolOrGaugeNo: string;
  toolName: string;
  worksheetRef: string;
  qtyConsumed: number;
  verifiedBySupervisor: boolean;
  verifiedBy: string | null;
  consumptionDate: string;
  creatUserIdCd: string;
}

export let consumptionMock: ToolConsumption[] = [
  { id: "CONS-001", dcNo: "DC-2026-001", toolOrGaugeNo: "TL-MIC-001", toolName: "Outside Micrometer 0-25mm", worksheetRef: "WS-2026-101", qtyConsumed: 1, verifiedBySupervisor: true, verifiedBy: "U0002", consumptionDate: "2026-07-22", creatUserIdCd: "U0001" },
];

// ── PO Receive / GRN (TOOLS_PO_RECEIVE + TOOLS_PO_RECEIVE_TRANS) ─
export type GRNStatus = "Draft" | "Posted" | "Cancelled";

export interface POReceiveHeader {
  id: string;
  grnNo: string;
  poRef: string;
  supCode: string;
  supName: string;
  grnDate: string;
  status: GRNStatus;
  creatUserIdCd: string;
  creatDt: string;
  lines: POReceiveLine[];
}

export interface POReceiveLine {
  id: string;
  grnNo: string;
  toolOrGaugeNo: string;
  toolName: string;
  poQty: number;
  receivedQty: number;
  pendingQty: number;
  unitRate: number;
}

export let poReceiveMock: POReceiveHeader[] = [
  {
    id: "GRN-001", grnNo: "GRN-MEQ-2026-001", poRef: "PO-MEQ-2026-001", supCode: "S001", supName: "Mitutoyo India Pvt Ltd", grnDate: "2026-07-20", status: "Posted", creatUserIdCd: "U0001", creatDt: "2026-07-20",
    lines: [
      { id: "GRL-001", grnNo: "GRN-MEQ-2026-001", toolOrGaugeNo: "TL-MIC-001", toolName: "Outside Micrometer 0-25mm", poQty: 5, receivedQty: 5, pendingQty: 0, unitRate: 3500.00 },
      { id: "GRL-002", grnNo: "GRN-MEQ-2026-001", toolOrGaugeNo: "TL-CAL-014", toolName: "Digital Vernier Caliper 150mm", poQty: 10, receivedQty: 8, pendingQty: 2, unitRate: 1800.00 },
    ]
  },
];

// ── PO Schedule (TOOLS_PO_SCH_MASTER + TOOLS_PO_SCH_TRANS) ────────
export type ScheduleStatus = "Pending" | "Partially Received" | "Completed";

export interface POScheduleHeader {
  id: string;
  scheduleNo: string;
  poRef: string;
  supCode: string;
  supName: string;
  createdDate: string;
  overallStatus: ScheduleStatus;
  creatUserIdCd: string;
  lines: POScheduleLine[];
}

export interface POScheduleLine {
  id: string;
  scheduleNo: string;
  toolOrGaugeNo: string;
  toolName: string;
  expectedDate: string;
  expectedQty: number;
  receivedQty: number;
  status: ScheduleStatus;
}

export let poSchedulesMock: POScheduleHeader[] = [
  {
    id: "SCH-001", scheduleNo: "SCH-2026-001", poRef: "PO-MEQ-2026-001", supCode: "S001", supName: "Mitutoyo India Pvt Ltd", createdDate: "2026-07-01", overallStatus: "Partially Received", creatUserIdCd: "U0001",
    lines: [
      { id: "SL-001", scheduleNo: "SCH-2026-001", toolOrGaugeNo: "TL-MIC-001", toolName: "Outside Micrometer 0-25mm", expectedDate: "2026-07-20", expectedQty: 5, receivedQty: 5, status: "Completed" },
      { id: "SL-002", scheduleNo: "SCH-2026-001", toolOrGaugeNo: "TL-CAL-014", toolName: "Digital Vernier Caliper 150mm", expectedDate: "2026-07-25", expectedQty: 10, receivedQty: 8, status: "Partially Received" },
    ]
  },
];

// ── Calibration Issue (TOOLS_ISSUE_FOR_CALIBRATION) ───────────────
export type CalibrationIssueType = "In-House" | "External";
export type CalibrationIssueStatus = "OPEN" | "RECEIVED" | "CLOSED";

export interface CalibrationIssueHeader {
  id: string;
  calibDcNo: string;
  issueType: CalibrationIssueType;
  labName: string;
  issueDate: string;
  expectedReturnDate: string;
  status: CalibrationIssueStatus;
  creatUserIdCd: string;
  lines: CalibrationIssueLine[];
}

export interface CalibrationIssueLine {
  id: string;
  calibDcNo: string;
  toolOrGaugeNo: string;
  toolName: string;
  lastCalibDate: string | null;
  dueDate: string | null;
}

export let calibrationIssuesMock: CalibrationIssueHeader[] = [
  {
    id: "CI-001", calibDcNo: "CALIB-DC-001", issueType: "External", labName: "Reliable Calibration Lab", issueDate: "2026-07-10", expectedReturnDate: "2026-07-20", status: "RECEIVED", creatUserIdCd: "U0001",
    lines: [
      { id: "CIL-001", calibDcNo: "CALIB-DC-001", toolOrGaugeNo: "TL-IND-003", toolName: "Dial Indicator 0.01mm", lastCalibDate: "2026-01-15", dueDate: "2026-07-15" },
    ]
  },
];

// ── Calibration Results (GAUGE_CONTROL_CARD_TRANS) ────────────────
export type CalibrationResult = "Pass" | "Fail" | "Conditional Pass";

export interface CalibrationRecord {
  id: string;
  toolOrGaugeNo: string;
  toolName: string;
  calibrationDate: string;
  calibratedBy: string;
  result: CalibrationResult;
  nextCalibDate: string;
  certificateFileName: string | null;
  remarks: string;
  creatUserIdCd: string;
}

export let calibrationRecordsMock: CalibrationRecord[] = [
  { id: "CR-001", toolOrGaugeNo: "TL-MIC-001", toolName: "Outside Micrometer 0-25mm", calibrationDate: "2026-01-15", calibratedBy: "Reliable Calibration Lab", result: "Pass", nextCalibDate: "2026-07-15", certificateFileName: "CERT-TL-MIC-001-JAN26.pdf", remarks: "All parameters within tolerance", creatUserIdCd: "U0001" },
  { id: "CR-002", toolOrGaugeNo: "TL-CAL-014", toolName: "Digital Vernier Caliper 150mm", calibrationDate: "2025-07-01", calibratedBy: "InHouse Repair Unit", result: "Pass", nextCalibDate: "2026-07-01", certificateFileName: null, remarks: "Zero error corrected", creatUserIdCd: "U0001" },
  { id: "CR-003", toolOrGaugeNo: "TL-IND-003", toolName: "Dial Indicator 0.01mm", calibrationDate: "2026-04-15", calibratedBy: "Reliable Calibration Lab", result: "Conditional Pass", nextCalibDate: "2026-07-15", certificateFileName: "CERT-TL-IND-003-APR26.pdf", remarks: "Spindle friction slightly high — monitor", creatUserIdCd: "U0001" },
];
