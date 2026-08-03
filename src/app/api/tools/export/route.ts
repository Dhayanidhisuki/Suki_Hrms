import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import {
  buildExcelBuffer,
  buildPdfBuffer,
  exportFilename,
} from "@/lib/serverReportExport";
import {
  TOOLS_MASTER_EXPORT_COLUMNS,
  columnsForTemplate,
  mapToolToExportRow,
  parseTemplateKind,
} from "@/lib/toolsMasterImportExport";

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

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const format = (req.nextUrl.searchParams.get("format") ?? "xlsx").toLowerCase();
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "format must be xlsx or pdf" }, { status: 400 });
  }

  const templateParam = req.nextUrl.searchParams.get("template");
  const templateKind = templateParam ? parseTemplateKind(templateParam) : null;

  try {
    // Empty template download for one of the 3 import formats
    if (templateParam != null) {
      if (!templateKind) {
        return NextResponse.json(
          { error: "template must be basic, full, or price" },
          { status: 400 }
        );
      }
      if (format !== "xlsx") {
        return NextResponse.json({ error: "Template is only available as xlsx" }, { status: 400 });
      }
      const columns = columnsForTemplate(templateKind);
      const buffer = buildExcelBuffer({
        sheetName: "Tools Master",
        columns,
        rows: [],
      });
      const filename = exportFilename(`tools_master_${templateKind}_template`, "xlsx");
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Export-Count": "0",
          "X-Export-Template": templateKind,
        },
      });
    }

    const selectedIds = parseIds(req.nextUrl.searchParams.get("ids"));
    const where = buildWhere(req.nextUrl.searchParams, selectedIds);
    const items = await prisma.gaugeAndTools.findMany({
      where,
      orderBy: { creatDt: "desc" },
      include: {
        serialNumbers: { orderBy: { serialNo: "asc" } },
        details: true,
      },
    });

    const rows = items.map(mapToolToExportRow);
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
