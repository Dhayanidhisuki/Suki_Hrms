import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const issue = await prisma.toolsIssueForCalibration.findUnique({
    where: { dcNo: Number(id) },
    include: {
      inHouseLines: { include: { tool: true } },
      receiveHeaders: { include: { lines: true } },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Calibration issue not found" }, { status: 404 });
  }

  const receives = issue.receiveHeaders?.length ?? 0;
  const lines = issue.inHouseLines ?? [];
  const done = lines.filter((l) => String(l.resultStatus ?? "").trim()).length;
  const status =
    receives > 0 || (done > 0 && done === lines.length)
      ? "CLOSED"
      : done > 0
        ? "PARTIAL"
        : "OPEN";

  return NextResponse.json({ issue: { ...issue, status } });
}
