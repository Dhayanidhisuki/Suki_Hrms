import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/**
 * GET /api/employees
 * Returns a list of all active employees.
 * Used as a data source for dropdowns (e.g., empId in Issue transactions).
 */
export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const items = await prisma.employee.findMany({
    where: { status: { not: "Inactive" } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      empCd: true,
      title: true,
      firstName: true,
      lastName: true,
      deptNo: true,
      status: true,
    },
  });

  return NextResponse.json({ items });
}
