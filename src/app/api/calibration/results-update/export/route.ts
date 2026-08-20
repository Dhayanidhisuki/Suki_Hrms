import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import {
  CALIB_RESULTS_EXPORT_COLUMNS,
  loadCalibResultsPending,
} from "@/lib/calibResultsData";
import {
  buildExcelBuffer,
  buildPdfBuffer,
  exportFilename,
} from "@/lib/serverReportExport";
import { resolveUnitScope, unitIsAllowed } from "@/lib/unitScope";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const format = (req.nextUrl.searchParams.get("format") ?? "xlsx").toLowerCase();
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "format must be xlsx or pdf" }, { status: 400 });
  }

  try {
    const unitScope = await resolveUnitScope(check.session);
    let rows = await loadCalibResultsPending(1000);
    if (!unitScope.unrestricted) {
      const toolNos = [...new Set(rows.map((row) => row.toolOrGaugeNo).filter(Boolean))];
      const tools = await prisma.gaugeAndTools.findMany({
        where: { toolOrGaugeNo: { in: toolNos } },
        select: { toolOrGaugeNo: true, locationName: true },
      });
      const allowed = new Set(tools.filter((tool) => unitIsAllowed(unitScope, tool.locationName)).map((tool) => tool.toolOrGaugeNo));
      rows = rows.filter((row) => allowed.has(row.toolOrGaugeNo));
    }
    const columns = [...CALIB_RESULTS_EXPORT_COLUMNS];
    const filename = exportFilename("calibration_results_pending", format);

    const buffer =
      format === "xlsx"
        ? buildExcelBuffer({
            sheetName: "Calib Results",
            columns,
            rows: rows as unknown as Record<string, unknown>[],
          })
        : buildPdfBuffer({
            title: "Calibration Results (Pending / Open)",
            subtitle: "TOOLS_TRANS_ISSUE_FOR_CALIBRATION — results update dataset",
            columns,
            rows: rows as unknown as Record<string, unknown>[],
          });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "X-Export-Count": String(rows.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Calib results export failed:", err);
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
