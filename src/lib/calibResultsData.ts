import { prisma } from "@/lib/prisma";

export type CalibResultExportRow = {
  refNo: number;
  dcNo: number | null;
  toolOrGaugeNo: string;
  name: string | null;
  description: string | null;
  grouping: string | null;
  type: string;
  status: string;
  frequency: string;
  calibrationFrqMonths: number | null;
  serialNo: number | null;
  location: string | null;
  locationName: string | null;
  calibDueDate: Date | string | null;
  cDate: Date | string | null;
  nextCDate: Date | string | null;
  remarks: string | null;
  receiveName: string | null;
  issueFor: string | null;
  calibratedBy: string | null;
  // Spec snapshot from tool master (ERP Update Calibration Results)
  gSpecUpperMin: number | string | null;
  gSpecUpperMax: number | string | null;
  wLimitLowerMax: number | string | null;
  wLimitUpperMin: number | string | null;
  wLimitUpperMax: number | string | null;
  prodSpecLowerMax: number | string | null;
  prodSpecUpperMin: number | string | null;
  prodSpecUpperMax: number | string | null;
};

/** Pending / open calibration result lines (same source as Results Update list). */
export async function loadCalibResultsPending(
  take = 500
): Promise<CalibResultExportRow[]> {
  const lines = await prisma.toolsTransIssueForCalibration.findMany({
    where: {
      OR: [
        { resultStatus: null },
        { resultStatus: "" },
        { calibrationStatus: { in: ["Pending", "PENDING", "Open", "OPEN"] } },
        { status: { in: ["Issued", "Under Calibration", "OPEN", "Received", "ISSUE FOR CALIBRATION"] } },
      ],
    },
    orderBy: { creatDt: "desc" },
    take,
    include: {
      tool: {
        select: {
          name: true,
          description: true,
          grouping: true,
          type: true,
          status: true,
          calibrationFrqMonths: true,
          location: true,
          locationName: true,
          gSpecUpperMin: true,
          gSpecUpperMax: true,
          wLimitLowerMax: true,
          wLimitUpperMin: true,
          wLimitUpperMax: true,
          prodSpecLowerMax: true,
          prodSpecUpperMin: true,
          prodSpecUpperMax: true,
        },
      },
      calibIssue: {
        select: { dcNo: true, receiveName: true, issueDate: true, issueFor: true },
      },
    },
  });

  return lines
    .filter((l) => l.toolOrGaugeNo)
    .map((l) => ({
      refNo: l.rowId,
      dcNo: l.dcNo,
      toolOrGaugeNo: l.toolOrGaugeNo as string,
      name: l.tool?.name ?? null,
      description: l.tool?.description ?? null,
      grouping: l.grouping ?? l.tool?.grouping ?? null,
      type: l.tool?.type ?? l.grouping ?? "General",
      status:
        l.resultStatus ||
        l.calibrationStatus ||
        l.status ||
        l.tool?.status ||
        "Under Calibration",
      frequency:
        l.tool?.calibrationFrqMonths != null
          ? `${l.tool.calibrationFrqMonths} Months`
          : "—",
      calibrationFrqMonths: l.tool?.calibrationFrqMonths ?? null,
      serialNo: l.serialNo ?? null,
      location: l.tool?.location ?? null,
      locationName: l.tool?.locationName ?? null,
      calibDueDate: l.calibDueDate ?? l.dueDate,
      cDate: l.calibratedDate ?? l.creatDt,
      nextCDate: l.nxtCalibDate ?? l.calibDueDate ?? l.dueDate,
      remarks: l.calibResultComments ?? l.remarks,
      receiveName: l.calibIssue?.receiveName ?? null,
      issueFor: l.calibIssue?.issueFor ?? null,
      calibratedBy: l.calibratedBy ?? null,
      gSpecUpperMin: l.tool?.gSpecUpperMin ?? null,
      gSpecUpperMax: l.tool?.gSpecUpperMax ?? null,
      wLimitLowerMax: l.tool?.wLimitLowerMax ?? null,
      wLimitUpperMin: l.tool?.wLimitUpperMin ?? null,
      wLimitUpperMax: l.tool?.wLimitUpperMax ?? null,
      prodSpecLowerMax: l.tool?.prodSpecLowerMax ?? null,
      prodSpecUpperMin: l.tool?.prodSpecUpperMin ?? null,
      prodSpecUpperMax: l.tool?.prodSpecUpperMax ?? null,
    }));
}

export const CALIB_RESULTS_EXPORT_COLUMNS = [
  { key: "dcNo", label: "DC No" },
  { key: "toolOrGaugeNo", label: "Tool No" },
  { key: "name", label: "Name" },
  { key: "grouping", label: "Group" },
  { key: "type", label: "Type" },
  { key: "status", label: "Result / Status" },
  { key: "frequency", label: "Frequency" },
  { key: "cDate", label: "Calib / Issue Date" },
  { key: "nextCDate", label: "Next Due" },
  { key: "receiveName", label: "Receive Name" },
  { key: "issueFor", label: "Issue For" },
  { key: "remarks", label: "Remarks / Certificate" },
] as const;
