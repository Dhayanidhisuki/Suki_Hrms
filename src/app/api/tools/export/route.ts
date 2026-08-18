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

// ─── Export column layout ────────────────────────────────────────────────────
// Uses master-level fields available on GAUGEANDTOOLS.
// The old three-mode template download is no longer exposed in the UI.

const TOOLS_MASTER_EXPORT_COLUMNS: ReportColumn[] = [
  { key: "TOOL_OR_GAUGE_NO", label: "Equip No" },
  { key: "DES", label: "Description" },
  { key: "SIZE", label: "Size" },
  { key: "LEAST_COUNT", label: "Least Count" },
  { key: "LOCATION", label: "Used Location" },
  { key: "CALIBRATION_FRQ_MONTHS", label: "Cal. Freq. (mths)" },
  { key: "STATUS", label: "Status" },
  { key: "REMARKS", label: "Remarks" },
  { key: "GROUPING", label: "Grouping" },
  { key: "TYPE", label: "Type" },
  { key: "NAME", label: "Name" },
];

function mapToolToExportRow(tool: {
  toolOrGaugeNo: string | null;
  description: string | null;
  size: string | null;
  leastCount: string | null;
  location: string | null;
  calibrationFrqMonths: number | null;
  status: string | null;
  remarks: string | null;
  grouping: string;
  type: string | null;
  name: string | null;
}): Record<string, unknown> {
  return {
    TOOL_OR_GAUGE_NO: tool.toolOrGaugeNo ?? "",
    DES: tool.description ?? "",
    SIZE: tool.size ?? "",
    LEAST_COUNT: tool.leastCount ?? "",
    LOCATION: tool.location ?? "",
    CALIBRATION_FRQ_MONTHS: tool.calibrationFrqMonths ?? "",
    STATUS: tool.status ?? "",
    REMARKS: tool.remarks ?? "",
    GROUPING: tool.grouping ?? "",
    TYPE: tool.type ?? "",
    NAME: tool.name ?? "",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildWhere(searchParams: URLSearchParams, selectedIds: number[]) {
  const search = searchParams.get("search") ?? "";
  const grouping = searchParams.get("grouping") ?? "";
  const status = searchParams.get("status") ?? "";

  if (selectedIds.length > 0) {
    return { refNo: { in: selectedIds } };
  }

  return {
    AND: [
      search
        ? {
            OR: [
              { toolOrGaugeNo: { contains: search } },
              { name: { contains: search } },
              { description: { contains: search } },
              { grouping: { contains: search } },
            ],
          }
        : {},
      grouping ? { grouping } : {},
      status ? { status } : {},
    ],
  };
}

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const format = (req.nextUrl.searchParams.get("format") ?? "xlsx").toLowerCase();
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "format must be xlsx or pdf" }, { status: 400 });
  }

  try {
    const selectedIds = parseIds(req.nextUrl.searchParams.get("ids"));
    const where = buildWhere(req.nextUrl.searchParams, selectedIds);
    const items = await prisma.gaugeAndTools.findMany({
      where,
      orderBy: { creatDt: "desc" },
    });

    const rows: Record<string, unknown>[] = items.map(mapToolToExportRow);
    const mode = selectedIds.length > 0 ? "selected" : "filtered";
    const subtitle =
      mode === "selected"
        ? `Selected tools (${rows.length})`
        : "Tools Master (current filters)";

    const buffer =
      format === "xlsx"
        ? buildExcelBuffer({
            sheetName: "Tools Master",
            columns: TOOLS_MASTER_EXPORT_COLUMNS,
            rows,
          })
        : buildPdfBuffer({
            title: "Tools Master Export",
            subtitle,
            columns: TOOLS_MASTER_EXPORT_COLUMNS,
            rows,
          });

    const filename = exportFilename(
      mode === "selected" ? "tools_master_selected" : "tools_master_filtered",
      format
    );
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Count": String(rows.length),
        "X-Export-Mode": mode,
      },
    });
  } catch (error) {
    console.error("Tools master export failed:", error);
    return NextResponse.json({ error: "Failed to export tools" }, { status: 500 });
  }
}
