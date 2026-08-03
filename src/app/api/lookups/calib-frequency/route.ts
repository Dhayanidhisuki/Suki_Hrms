import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";

const FALLBACK_CALIB_FREQS = [
  { id: 1, prodToleranceMin: "0.001mm", prodToleranceMax: 1.00, calibFrequency: 3 },
  { id: 2, prodToleranceMin: "0.010mm", prodToleranceMax: 5.00, calibFrequency: 6 },
  { id: 3, prodToleranceMin: "5.000mm", prodToleranceMax: 50.00, calibFrequency: 12 },
];

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  try {
    const rawItems = await prisma.calibrationFrequencyMaster.findMany({
      orderBy: { creatDt: "desc" },
    });

    if (rawItems.length === 0) {
      return NextResponse.json({ items: FALLBACK_CALIB_FREQS });
    }

    const items = rawItems.map((item) => ({
      id: item.rowId,
      prodToleranceMin: item.prodToleranceMin,
      prodToleranceMax: item.prodToleranceMax ? Number(item.prodToleranceMax) : null,
      calibFrequency: item.calibFrequency,
      rowId: item.rowId,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching calibration frequencies:", error);
    return NextResponse.json({ items: FALLBACK_CALIB_FREQS });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();

  try {
    const item = await prisma.calibrationFrequencyMaster.create({
      data: {
        prodToleranceMin: body.prodToleranceMin,
        prodToleranceMax: body.prodToleranceMax,
        calibFrequency: body.calibFrequency,
        creatUserIdCd: authCheck.session.userId,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        item: {
          id: item.rowId,
          prodToleranceMin: item.prodToleranceMin,
          prodToleranceMax: item.prodToleranceMax ? Number(item.prodToleranceMax) : null,
          calibFrequency: item.calibFrequency,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating calibration frequency:", error);
    return NextResponse.json({ error: "Failed to create calibration frequency" }, { status: 500 });
  }
}
