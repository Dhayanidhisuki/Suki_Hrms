import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import {
  AppUserCreateSchema,
  AppUserUpdateSchema,
} from "@/lib/validators";

export const runtime = "nodejs";

function mapUser(u: {
  id: number;
  username: string;
  name: string;
  email: string | null;
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
    email: u.email,
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

  const [users, dbRoles] = await Promise.all([
    prisma.user.findMany({
      where: includeInactive
        ? { deletedAt: null }
        : { deletedAt: null, isActive: true },
      orderBy: [{ isActive: "desc" }, { username: "asc" }],
      include: {
        userRole: { include: { role: true } },
        unitScopes: true,
      },
    }),
    prisma.role.findMany({ orderBy: { roleId: "asc" } }),
  ]);

  const items = users.map((u) => {
    const roleObj = u.userRole?.role;
    const roleName = roleObj?.roleName ?? u.role;
    const isSystemAdmin = roleObj?.isSystemAdmin ?? (roleName === "Tools Admin" || u.username.toLowerCase() === "admin");

    return {
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: roleName,
      roleId: roleObj?.roleId ?? null,
      isSystemAdmin,
      unitScopes: u.unitScopes.map((scope) => scope.unitScope),
      erpUserCode: u.erpUserCode,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({
    items,
    roles: dbRoles.map((r) => r.roleName),
    rolesList: dbRoles,
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

  const { username, password, name, email, role, erpUserCode } = parsed.data;
  const unitScopes: string[] = Array.isArray(body?.unitScopes) ? body.unitScopes : [];

  const existing = await prisma.user.findFirst({
    where: { username },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Username already exists" },
      { status: 409 }
    );
  }
  if (email) {
    const emailOwner = await prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (emailOwner) {
      return NextResponse.json({ error: "Email address is already assigned to another user" }, { status: 409 });
    }
  }

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        name,
        email: email || null,
        role,
        erpUserCode: erpUserCode ?? null,
        isActive: true,
      },
    });

    // Assign Role in TOOLS_APP_USER_ROLE
    const dbRole = await prisma.role.findFirst({ where: { roleName: role } });
    if (dbRole) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: dbRole.roleId },
      });

    }
    if (unitScopes.length > 0) {
      await prisma.userUnitScope.createMany({
        data: [...new Set(unitScopes)].map((unitScope) => ({ userId: user.id, unitScope })),
      });
    }

    return NextResponse.json(
      { ok: true, user: mapUser(user) },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("TOOLS_APP_USER_email_unique")) {
      return NextResponse.json(
        { error: "Email address is already assigned to another user" },
        { status: 409 }
      );
    }
    if (msg.includes("Unique constraint") || msg.includes("TOOLS_APP_USER_username_key")) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create user: " + msg },
      { status: 500 }
    );
  }
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

  const { id, password, name, email, role, erpUserCode, isActive } = parsed.data;
  const unitScopes: string[] = Array.isArray(body?.unitScopes) ? body.unitScopes : [];

  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (email) {
    const emailOwner = await prisma.user.findFirst({
      where: { email, id: { not: id } },
      select: { id: true },
    });
    if (emailOwner) {
      return NextResponse.json({ error: "Email address is already assigned to another user" }, { status: 409 });
    }
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
    email?: string | null;
    role?: string;
    erpUserCode?: string | null;
    isActive?: boolean;
    passwordHash?: string;
    deletedAt?: Date | null;
  } = {};

  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email || null;
  if (role !== undefined) data.role = role;
  if (erpUserCode !== undefined) data.erpUserCode = erpUserCode;
  if (isActive !== undefined) {
    data.isActive = isActive;
    if (isActive === false) data.deletedAt = null;
  }
  if (password && password.length >= 8) {
    data.passwordHash = await hashPassword(password);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
  });

  // Update Role in TOOLS_APP_USER_ROLE
  if (role) {
    const dbRole = await prisma.role.findFirst({ where: { roleName: role } });
    if (dbRole) {
      await prisma.userRole.upsert({
        where: { userId: id },
        update: { roleId: dbRole.roleId },
        create: { userId: id, roleId: dbRole.roleId },
      });

    }
  }
  await prisma.$transaction([
    prisma.userUnitScope.deleteMany({ where: { userId: id } }),
    ...(unitScopes.length > 0
      ? [
          prisma.userUnitScope.createMany({
            data: [...new Set(unitScopes)].map((unitScope) => ({ userId: id, unitScope })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true, user: mapUser(user) });
}
