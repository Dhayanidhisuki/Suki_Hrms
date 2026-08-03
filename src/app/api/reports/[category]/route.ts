import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import {
  buildExcelBuffer,
  buildPdfBuffer,
  exportFilename,
  type ReportColumn,
} from "@/lib/serverReportExport";

type Category =
  | "tools"
  | "calibration"
  | "suppliers"
  | "subcontractors"
  | "tools-history";

const CATEGORIES: Category[] = [
  "tools",
  "calibration",
  "suppliers",
  "subcontractors",
  "tools-history",
];

function yesNo(v: string | null | undefined) {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "YES" || s === "Y";
}

function mapStatus(v: string | null | undefined) {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "ACTIVE" || s === "A" ? "Active" : v ? String(v) : "";
}

async function loadCategory(category: Category): Promise<{
  title: string;
  subtitle: string;
  filename: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
}> {
  switch (category) {
    case "tools": {
      const items = await prisma.gaugeAndTools.findMany({
        orderBy: { creatDt: "desc" },
        select: {
          toolOrGaugeNo: true,
          name: true,
          description: true,
          grouping: true,
          type: true,
          status: true,
          locationName: true,
          area: true,
          rack: true,
          totQty: true,
          qtyIn: true,
          qtyOut: true,
          qtyNew: true,
          qtyInUse: true,
          calibrationFrqMonths: true,
          creatDt: true,
        },
      });
      return {
        title: "All Tool Reports",
        subtitle: "Full GAUGEANDTOOLS register",
        filename: "all_tools_report",
        columns: [
          { key: "toolOrGaugeNo", label: "Tool No" },
          { key: "name", label: "Name" },
          { key: "description", label: "Description" },
          { key: "grouping", label: "Group" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "locationName", label: "Location" },
          { key: "area", label: "Area" },
          { key: "rack", label: "Rack" },
          { key: "totQty", label: "Total Qty" },
          { key: "qtyIn", label: "Qty In" },
          { key: "qtyOut", label: "Qty Out" },
          { key: "qtyNew", label: "Qty New" },
          { key: "qtyInUse", label: "Qty In Use" },
          { key: "calibrationFrqMonths", label: "Calib Freq (Months)" },
          { key: "creatDt", label: "Created" },
        ],
        rows: items as unknown as Record<string, unknown>[],
      };
    }

    case "calibration": {
      const alertDays = Number(process.env.CALIBRATION_ALERT_DAYS ?? 90);
      const alertDate = new Date();
      alertDate.setDate(alertDate.getDate() + alertDays);

      const lines = await prisma.toolsTransIssueForCalibration.findMany({
        where: {
          OR: [
            { nxtCalibDate: { lte: alertDate } },
            { calibDueDate: { lte: alertDate } },
            { dueDate: { lte: alertDate } },
          ],
        },
        orderBy: [{ nxtCalibDate: "asc" }, { calibDueDate: "asc" }, { dueDate: "asc" }],
        include: {
          tool: {
            select: {
              name: true,
              grouping: true,
              type: true,
              status: true,
              calibrationFrqMonths: true,
            },
          },
        },
      });

      const byTool = new Map<string, Record<string, unknown>>();
      for (const line of lines) {
        const toolNo = line.toolOrGaugeNo;
        if (!toolNo) continue;
        const next = line.nxtCalibDate ?? line.calibDueDate ?? line.dueDate;
        const existing = byTool.get(toolNo);
        const existingNext = existing?.nextCalibrationDate
          ? new Date(String(existing.nextCalibrationDate))
          : null;
        if (!existing || (next && (!existingNext || next < existingNext))) {
          byTool.set(toolNo, {
            toolOrGaugeNo: toolNo,
            name: line.tool?.name ?? "",
            grouping: line.grouping ?? line.tool?.grouping ?? "",
            type: line.tool?.type ?? "",
            status:
              line.resultStatus ??
              line.calibrationStatus ??
              line.status ??
              line.tool?.status ??
              "",
            frequency:
              line.tool?.calibrationFrqMonths != null
                ? `${line.tool.calibrationFrqMonths} Months`
                : "",
            lastCalibrated: line.calibratedDate ?? line.creatDt,
            nextCalibrationDate: next,
            remarks: line.calibResultComments ?? line.remarks ?? "",
            dcNo: line.dcNo,
          });
        }
      }

      const rows = Array.from(byTool.values()).sort((a, b) => {
        const da = a.nextCalibrationDate ? new Date(String(a.nextCalibrationDate)).getTime() : 0;
        const db = b.nextCalibrationDate ? new Date(String(b.nextCalibrationDate)).getTime() : 0;
        return da - db;
      });

      return {
        title: "Calibration Reports",
        subtitle: "Full due / overdue calibration dataset",
        filename: "all_calibration_report",
        columns: [
          { key: "toolOrGaugeNo", label: "Tool No" },
          { key: "name", label: "Name" },
          { key: "grouping", label: "Group" },
          { key: "type", label: "Type" },
          { key: "frequency", label: "Frequency" },
          { key: "lastCalibrated", label: "Last Calibrated" },
          { key: "nextCalibrationDate", label: "Next Due" },
          { key: "status", label: "Status" },
          { key: "dcNo", label: "DC No" },
          { key: "remarks", label: "Remarks" },
        ],
        rows,
      };
    }

    case "suppliers": {
      const items = await prisma.supplier.findMany({
        orderBy: { creatDt: "desc" },
      });
      return {
        title: "Supplier Report",
        subtitle: "Full SUPPLIER master",
        filename: "all_suppliers_report",
        columns: [
          { key: "supCode", label: "Code" },
          { key: "supName", label: "Name" },
          { key: "add1", label: "Address" },
          { key: "city", label: "City" },
          { key: "state", label: "State" },
          { key: "gstin", label: "GSTIN" },
          { key: "phone1", label: "Phone" },
          { key: "emailId", label: "Email" },
          { key: "approvedSupplier", label: "Approved" },
          { key: "status", label: "Status" },
          { key: "creatDt", label: "Created" },
        ],
        rows: items as unknown as Record<string, unknown>[],
      };
    }

    case "subcontractors": {
      const items = await prisma.subcontractor.findMany({
        orderBy: { creatDt: "desc" },
      });
      const rows = items.map((item) => ({
        subCode: item.subConId,
        subName: item.subName ?? "",
        natureOfWork: item.natureOfWork ?? "",
        gstin: item.gstin ?? "",
        address: [item.add1, item.add2].filter(Boolean).join(", "),
        isInhouse: yesNo(item.isInhouse) ? "Yes" : "No",
        isStoreVendor: yesNo(item.isStoreVendor) ? "Yes" : "No",
        isIssueDC: yesNo(item.isIssueDc) ? "Yes" : "No",
        status: mapStatus(item.status),
        creatDt: item.creatDt,
      }));
      return {
        title: "Subcontractor Report",
        subtitle: "Full SUBCONTRACTOR master",
        filename: "all_subcontractors_report",
        columns: [
          { key: "subCode", label: "Code" },
          { key: "subName", label: "Name" },
          { key: "natureOfWork", label: "Nature of Work" },
          { key: "gstin", label: "GSTIN" },
          { key: "address", label: "Address" },
          { key: "isInhouse", label: "In-House" },
          { key: "isStoreVendor", label: "Store Vendor" },
          { key: "isIssueDC", label: "DC Issue" },
          { key: "status", label: "Status" },
          { key: "creatDt", label: "Created" },
        ],
        rows,
      };
    }

    case "tools-history": {
      const items = await prisma.gaugeToolsIssue.findMany({
        orderBy: { creatDt: "desc" },
        include: {
          lines: {
            select: {
              toolOrGaugeNo: true,
              issueQty: true,
              name: true,
              status: true,
            },
          },
        },
      });

      const rows: Record<string, unknown>[] = [];
      for (const issue of items) {
        if (!issue.lines.length) {
          rows.push({
            dcNo: issue.dcNo,
            receiveName: issue.receiveName,
            subCode: issue.subCode,
            empId: issue.empId,
            issueDate: issue.issueDate,
            dueDate: issue.dueDate,
            status: issue.status,
            custCode: issue.custCode,
            issuePurpose: issue.issuePurpose,
            toolOrGaugeNo: "",
            toolName: "",
            issueQty: "",
            lineStatus: "",
          });
          continue;
        }
        for (const line of issue.lines) {
          rows.push({
            dcNo: issue.dcNo,
            receiveName: issue.receiveName,
            subCode: issue.subCode,
            empId: issue.empId,
            issueDate: issue.issueDate,
            dueDate: issue.dueDate,
            status: issue.status,
            custCode: issue.custCode,
            issuePurpose: issue.issuePurpose,
            toolOrGaugeNo: line.toolOrGaugeNo,
            toolName: line.name,
            issueQty: line.issueQty,
            lineStatus: line.status,
          });
        }
      }

      return {
        title: "Tools History Report",
        subtitle: "Full tool issue history with lines",
        filename: "all_tools_history_report",
        columns: [
          { key: "dcNo", label: "DC No" },
          { key: "receiveName", label: "Party / Holder" },
          { key: "subCode", label: "Sub Code" },
          { key: "empId", label: "Emp Id" },
          { key: "issueDate", label: "Issue Date" },
          { key: "dueDate", label: "Due Date" },
          { key: "status", label: "Header Status" },
          { key: "custCode", label: "Customer" },
          { key: "issuePurpose", label: "Purpose" },
          { key: "toolOrGaugeNo", label: "Tool No" },
          { key: "toolName", label: "Tool Name" },
          { key: "issueQty", label: "Qty" },
          { key: "lineStatus", label: "Line Status" },
        ],
        rows,
      };
    }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { category: raw } = await params;
  const category = raw as Category;
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `Unknown report category. Use: ${CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "xlsx").toLowerCase();
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "format must be xlsx or pdf" }, { status: 400 });
  }

  try {
    const data = await loadCategory(category);
    if (!data.rows.length) {
      return NextResponse.json({ error: "No records found for this report" }, { status: 404 });
    }

    const filename = exportFilename(data.filename, format);
    const buffer =
      format === "xlsx"
        ? buildExcelBuffer({
            sheetName: data.title,
            columns: data.columns,
            rows: data.rows,
          })
        : buildPdfBuffer({
            title: data.title,
            subtitle: data.subtitle,
            columns: data.columns,
            rows: data.rows,
          });

    const contentType =
      format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Export-Count": String(data.rows.length),
      },
    });
  } catch (error) {
    console.error(`Report export failed [${category}/${format}]:`, error);
    return NextResponse.json({ error: "Failed to export report" }, { status: 500 });
  }
}
