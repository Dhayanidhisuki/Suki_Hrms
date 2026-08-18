import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

type Event = { id: string; type: string; date: Date | null; title: string; detail: string; status?: string | null };

export async function GET(_req: Request, context: { params: Promise<{ toolNo: string }> }) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;
  const { toolNo: encoded } = await context.params;
  const toolNo = decodeURIComponent(encoded);
  const tool = await prisma.gaugeAndTools.findUnique({ where: { toolOrGaugeNo: toolNo }, select: { refNo: true, toolOrGaugeNo: true, description: true, grouping: true, status: true } });
  if (!tool) return NextResponse.json({ error: "Instrument not found" }, { status: 404 });

  const [calibrations, movements, documents, defects, services, deviations] = await Promise.all([
    prisma.calibrationResultDetail.findMany({ where: { toolOrGaugeNo: toolNo }, orderBy: { calibratedDate: "desc" } }),
    prisma.toolsTransIssue.findMany({ where: { toolOrGaugeNo: toolNo }, include: { header: true }, orderBy: { creatDt: "desc" } }),
    prisma.toolDocument.findMany({ where: { toolOrGaugeNo: toolNo, deletedAt: null }, orderBy: { creatDt: "desc" } }),
    prisma.instrumentDefect.findMany({ where: { refNo: tool.refNo }, orderBy: { reportedDate: "desc" } }),
    prisma.instrumentServiceRecord.findMany({ where: { refNo: tool.refNo }, orderBy: { createdAt: "desc" } }),
    prisma.calibrationDeviation.findMany({ where: { toolOrGaugeNo: toolNo }, orderBy: { recordedAt: "desc" } }),
  ]);

  const events: Event[] = [
    ...calibrations.map((r) => ({ id: `cal-${r.id}`, type: "CALIBRATION", date: r.calibratedDate, title: `Calibration ${r.resultStatus}`, detail: `Next due ${r.nextCalibDate.toISOString().split("T")[0]}${r.certificateNo ? ` · Certificate ${r.certificateNo}` : ""}`, status: r.resultStatus })),
    ...movements.map((r) => ({ id: `move-${r.rowId}`, type: "MOVEMENT", date: r.creatDt, title: `Movement DC ${r.dcNo}`, detail: `${r.header?.fromUnit || "—"} → ${r.issueToItemNo || "—"} · Qty ${r.issueQty ?? 0}`, status: r.status })),
    ...documents.map((r) => ({ id: `doc-${r.id}`, type: "DOCUMENT", date: r.creatDt, title: r.docType, detail: r.originalName })),
    ...defects.map((r) => ({ id: `defect-${r.id}`, type: "DEFECT", date: r.reportedDate, title: r.status, detail: r.defectDetails, status: r.status })),
    ...services.map((r) => ({ id: `service-${r.id}`, type: "SERVICE", date: r.sentDate ?? r.createdAt, title: r.status, detail: `${r.serviceAgency || "Internal service"}${r.repairDetails ? ` · ${r.repairDetails}` : ""}`, status: r.finalStatus ?? r.status })),
    ...deviations.map((r) => ({ id: `dev-${r.id}`, type: "DEVIATION", date: r.recordedAt, title: `${r.parameter}: ${r.resultStatus}`, detail: `${r.deviation}${r.correctiveAction ? ` · Action: ${r.correctiveAction}` : ""}`, status: r.resultStatus })),
  ].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  return NextResponse.json({ tool, events });
}
