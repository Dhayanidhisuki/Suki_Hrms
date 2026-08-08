import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import {
  AppUserCreateSchema,
  AppUserUpdateSchema,
} from "@/lib/validators";
import { CANONICAL_ROLES } from "@/lib/rolePermissions";

export const runtime = "nodejs";

function mapUser(u: {
  id: number;
  username: string;
  name: string;
  role: string;
  erpUserCode: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    erpUserCode: u.erpUserCode,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

/** GET /api/users — list app users (admin). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(
    authCheck.session,
    "canManageUsers"
  );
  if (!permCheck.ok) return permCheck.response;

  const includeInactive =
    req.nextUrl.searchParams.get("includeInactive") === "1" ||
    req.nextUrl.searchParams.get("includeInactive") === "true";

  const users = await prisma.user.findMany({
    where: includeInactive
      ? { deletedAt: null }
      : { deletedAt: null, isActive: true },
    orderBy: [{ isActive: "desc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      erpUserCode: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    items: users.map(mapUser),
    roles: CANONICAL_ROLES,
  });
}

/** POST /api/users — create app user (admin). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(
    authCheck.session,
    "canManageUsers"
  );
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json().catch(() => null);
  const parsed = AppUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { username, password, name, role, erpUserCode } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Username already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      name,
      role,
      erpUserCode: erpUserCode ?? null,
      isActive: true,
    },
  });

  return NextResponse.json(
    { ok: true, user: mapUser(user) },
    { status: 201 }
  );
}

/** PUT /api/users — update / deactivate app user (admin). No hard-delete. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(
    authCheck.session,
    "canManageUsers"
  );
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json().catch(() => null);
  const parsed = AppUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, password, name, role, erpUserCode, isActive } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent self-lockout
  if (
    isActive === false &&
    (authCheck.session.userDbId === id ||
      authCheck.session.userId.toLowerCase() ===
        existing.username.toLowerCase())
  ) {
    return NextResponse.json(
      { error: "You cannot deactivate your own account" },
      { status: 400 }
    );
  }

  const data: {
    name?: string;
    role?: string;
    erpUserCode?: string | null;
    isActive?: boolean;
    passwordHash?: string;
    deletedAt?: Date | null;
  } = {};

  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = role;
  if (erpUserCode !== undefined) data.erpUserCode = erpUserCode;
  if (isActive !== undefined) {
    data.isActive = isActive;
    // Soft-deactivate only — keep row for audit / reactivation
    if (isActive === false) data.deletedAt = null;
  }
  if (password && password.length >= 8) {
    data.passwordHash = await hashPassword(password);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
  });

  return NextResponse.json({ ok: true, user: mapUser(user) });
}
