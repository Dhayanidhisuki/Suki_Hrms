import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { generateDocNumber } from "@/lib/autonumber";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { ToolsIssueCreateSchema } from "@/lib/validators";

function maintainsSerial(flag: string | null | undefined): boolean {
  const v = (flag ?? "").trim().toLowerCase();
  return v === "yes" || v === "y" || v === "1" || v === "true";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status");
  const search = searchParams.get("search") ?? "";
  const customerOnly = searchParams.get("customerOnly") === "1";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Number(searchParams.get("pageSize") ?? 50));
  const skip = (page - 1) * pageSize;

  try {
    const where = {
      AND: [
        statusFilter ? { status: statusFilter } : {},
        customerOnly ? { custCode: { not: null } } : {},
        search
          ? {
              OR: [
                { dcNo: { contains: search } },
                { receiveName: { contains: search } },
                { subCode: { contains: search } },
                { custCode: { contains: search } },
                { transportName: { contains: search } },
                { poOrderNo: { contains: search } },
              ],
            }
          : {},
      ],
    };

    const toolPreview = {
      select: {
        toolOrGaugeNo: true,
        name: true,
        description: true,
        type: true,
        grouping: true,
        uom: true,
      },
    } as const;

    const [items, total] = await Promise.all([
      prisma.gaugeToolsIssue.findMany({
        where,
        include: {
          lines: {
            include: { tool: toolPreview, toolByRef: toolPreview },
          },
        },
        orderBy: { creatDt: "desc" },
        take: pageSize,
        skip,
      }),
      prisma.gaugeToolsIssue.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    console.error("Error fetching issue records:", error);
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canCreateIssue");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = ToolsIssueCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const {
    receiveName,
    receiveNameTwo,
    subCode,
    supCode,
    custCode,
    empId,
    issueDate,
    dueDate,
    issueOption,
    dcRefNo,
    returnable,
    transportName,
    vehicleNo,
    comments,
    lobType,
    poOrderNo,
    fromUnit,
    itemType,
    lines,
  } = data;

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);

    const issue = await prisma.$transaction(async (tx) => {
      const toolsByNo = new Map<string, Awaited<ReturnType<typeof tx.gaugeAndTools.findUnique>>>();
      for (const line of lines) {
        const tool = await tx.gaugeAndTools.findUnique({
          where: { toolOrGaugeNo: line.toolOrGaugeNo },
        });
        if (!tool) {
          throw new Error(`Tool not found: ${line.toolOrGaugeNo}`);
        }
        // ERP: stock reduces only when serial numbers are NOT maintained
        if (!maintainsSerial(tool.serialNoGenReq) && Number(tool.qtyIn ?? 0) < line.issueQty) {
          throw new Error(
            `Insufficient stock for ${line.toolOrGaugeNo}. Available: ${tool.qtyIn ?? 0}, Requested: ${line.issueQty}`
          );
        }
        toolsByNo.set(line.toolOrGaugeNo, tool);
      }

      const dcNo = await generateDocNumber("DC", "GAUGE_TOOLS_ISSUE", "DC_NO");
      const headerReturnable = returnable === "No" ? "No" : "Yes";

      const header = await tx.gaugeToolsIssue.create({
        data: {
          dcNo,
          receiveName,
          receiveNameTwo: receiveNameTwo || null,
          subCode: subCode || null,
          supCode: supCode || null,
          custCode: custCode || null,
          empId: empId ?? 0,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          issueOption: issueOption || "SubContractor",
          dcRefNo: dcRefNo || null,
          returnable: headerReturnable,
          transportName: transportName || null,
          vehicleNo: vehicleNo || null,
          comments: comments || null,
          lobType,
          poOrderNo: poOrderNo || null,
          fromUnit: fromUnit || null,
          itemType: itemType || null,
          status: "Active",
          creatUserIdCd: erpActor,
          creatDt: new Date(),
        },
      });

      let nextRowId =
        ((await tx.toolsTransIssue.aggregate({ _max: { rowId: true } }))._max.rowId ?? 0) + 1;

      for (const line of lines) {
        const tool = toolsByNo.get(line.toolOrGaugeNo);
        const partNo = (line.partNo?.trim() || line.toolOrGaugeNo).slice(0, 50);
        const price = line.price != null ? Number(line.price) : null;
        const amount = price != null ? price * line.issueQty : null;
        const lineReturnable = line.returnable === "No" ? "No" : headerReturnable;

        await tx.toolsTransIssue.create({
          data: {
            rowId: nextRowId++,
            dcNo,
            toolOrGaugeNo: line.toolOrGaugeNo,
            issueQty: line.issueQty,
            partNo,
            name: tool?.name?.slice(0, 50),
            description: tool?.description?.slice(0, 500),
            type: tool?.type?.slice(0, 50),
            groupName: tool?.grouping?.slice(0, 50),
            uom: tool?.uom?.slice(0, 10),
            issueType: tool?.issueType?.slice(0, 25),
            issueEmpName: receiveName?.slice(0, 50),
            returnable: lineReturnable,
            machine: line.machine?.slice(0, 50) || null,
            processName: line.processName?.slice(0, 100) || null,
            remarks: line.remarks?.slice(0, 100) || null,
            serialNo: line.serialNo ?? null,
            price,
            amount,
            toolRefNo: tool?.refNo,
            status: "Open",
            dueDate: new Date(dueDate),
            creatUserIdCd: erpActor,
            creatDt: new Date(),
          },
        });

        // ERP note: stock reduced only where serial numbers are NOT maintained
        if (tool && !maintainsSerial(tool.serialNoGenReq)) {
          await tx.gaugeAndTools.update({
            where: { toolOrGaugeNo: line.toolOrGaugeNo },
            data: {
              qtyIn: { decrement: line.issueQty },
              qtyOut: { increment: line.issueQty },
              lstUpdtUserIdCd: erpActor,
            },
          });
        }
      }

      return header;
    });

    return NextResponse.json({ ok: true, issue }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
