import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requirePermission, requireSession } from "@/lib/auth";

const AgencySchema = z.object({
  id: z.number().int().positive().optional(),
  agencyCode: z.string().trim().min(1).max(10),
  agencyName: z.string().trim().min(1).max(100),
  address: z.string().trim().max(500).optional().nullable(),
  contactPerson: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(150).optional().or(z.literal("")).nullable(),
  accreditationNo: z.string().trim().max(100).optional().nullable(),
  accreditationExpiry: z.string().date().optional().or(z.literal("")).nullable(),
  capabilities: z.string().trim().max(1000).optional().nullable(),
  isAuthorized: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const selectable = req.nextUrl.searchParams.get("selectable") === "1";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = await prisma.authorizedCalibrationAgency.findMany({
    where: selectable
      ? {
          isActive: true,
          isAuthorized: true,
          OR: [
            { accreditationExpiry: null },
            { accreditationExpiry: { gte: today } },
          ],
        }
      : undefined,
    orderBy: [{ isActive: "desc" }, { agencyName: "asc" }],
  });
  return NextResponse.json({ items });
}

async function mutationAccess() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check;
  const permission = await requirePermission(check.session, "canManageCalibration");
  if (!permission.ok) return permission;
  return { ok: true as const, session: check.session };
}

export async function POST(req: NextRequest) {
  const access = await mutationAccess();
  if (!access.ok) return access.response;
  const parsed = AgencySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id: _id, accreditationExpiry, ...data } = parsed.data;
  void _id;
  try {
    const item = await prisma.authorizedCalibrationAgency.create({
      data: {
        ...data,
        accreditationExpiry: accreditationExpiry ? new Date(accreditationExpiry) : null,
        createdBy: access.session.userId.slice(0, 50),
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && /unique/i.test(error.message)
      ? "Agency code already exists"
      : error instanceof Error ? error.message : "Failed to create agency";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const access = await mutationAccess();
  if (!access.ok) return access.response;
  const parsed = AgencySchema.safeParse(await req.json());
  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json({ error: "Valid agency id and fields are required" }, { status: 400 });
  }
  const { id, accreditationExpiry, ...data } = parsed.data;
  const item = await prisma.authorizedCalibrationAgency.update({
    where: { id },
    data: {
      ...data,
      accreditationExpiry: accreditationExpiry ? new Date(accreditationExpiry) : null,
      updatedBy: access.session.userId.slice(0, 50),
    },
  });
  return NextResponse.json({ item });
}
