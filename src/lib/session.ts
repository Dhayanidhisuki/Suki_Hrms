import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export interface SessionData {
  userId: string;
  name: string;
  empCd: string | null;
  roleName: string;
  addRoleName: string | null;
  isLoggedIn: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: process.env.SESSION_COOKIE_NAME ?? "suki_tools_session",
  ttl: Number(process.env.SESSION_TTL_SECONDS ?? 28800),
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  },
};

// Use in Server Components and Route Handlers
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

// Use in middleware
export async function getSessionFromRequest(
  req: NextRequest,
  res: NextResponse
): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(req, res, sessionOptions);
}

// Role permission matrix — single source of truth for backend checks
export type UserRole =
  | "Tools Admin"
  | "Store Keeper"
  | "Calibration Engineer"
  | "Purchase Coordinator"
  | "Viewer";

export const rolePermissions: Record<
  string,
  {
    canApproveSupplier: boolean;
    canCreateIssue: boolean;
    canReceiveTool: boolean;
    canLogConsumption: boolean;
    canManageCalibration: boolean;
    canRaisePO: boolean;
    canEditMaster: boolean;
    canDeleteMaster: boolean;
  }
> = {
  "Tools Admin": {
    canApproveSupplier: true,
    canCreateIssue: true,
    canReceiveTool: true,
    canLogConsumption: true,
    canManageCalibration: true,
    canRaisePO: true,
    canEditMaster: true,
    canDeleteMaster: true,
  },
  "Store Keeper": {
    canApproveSupplier: false,
    canCreateIssue: true,
    canReceiveTool: true,
    canLogConsumption: false,
    canManageCalibration: false,
    canRaisePO: false,
    canEditMaster: false,
    canDeleteMaster: false,
  },
  "Calibration Engineer": {
    canApproveSupplier: false,
    canCreateIssue: false,
    canReceiveTool: false,
    canLogConsumption: false,
    canManageCalibration: true,
    canRaisePO: false,
    canEditMaster: false,
    canDeleteMaster: false,
  },
  "Purchase Coordinator": {
    canApproveSupplier: false,
    canCreateIssue: false,
    canReceiveTool: false,
    canLogConsumption: false,
    canManageCalibration: false,
    canRaisePO: true,
    canEditMaster: false,
    canDeleteMaster: false,
  },
  Viewer: {
    canApproveSupplier: false,
    canCreateIssue: false,
    canReceiveTool: false,
    canLogConsumption: false,
    canManageCalibration: false,
    canRaisePO: false,
    canEditMaster: false,
    canDeleteMaster: false,
  },
};
