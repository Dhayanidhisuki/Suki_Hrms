import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/lib/session";
import {
  COMPANY_UNITS,
  normalizeCompanyUnit,
  unitStorageVariants,
  type CompanyUnitLabel,
} from "@/lib/companyUnits";
import { isAdminRole } from "@/lib/adminRoles";

export interface ResolvedUnitScope {
  unrestricted: boolean;
  units: CompanyUnitLabel[];
}

export async function resolveUnitScope(session: SessionData): Promise<ResolvedUnitScope> {
  if (isAdminRole(session.roleName)) {
    return { unrestricted: true, units: COMPANY_UNITS.map((unit) => unit.label) };
  }
  if (session.userDbId == null) return { unrestricted: false, units: [] };

  const rows = await prisma.userUnitScope.findMany({
    where: { userId: session.userDbId },
    select: { unitScope: true },
  });
  if (rows.some((row) => row.unitScope.trim().toUpperCase() === "COMMON")) {
    return { unrestricted: true, units: COMPANY_UNITS.map((unit) => unit.label) };
  }
  const units = rows
    .map((row) => normalizeCompanyUnit(row.unitScope))
    .filter((unit): unit is CompanyUnitLabel => Boolean(unit));
  return { unrestricted: false, units: [...new Set(units)] };
}

export function unitIsAllowed(scope: ResolvedUnitScope, value: string | null | undefined): boolean {
  if (scope.unrestricted) return true;
  const unit = normalizeCompanyUnit(value);
  return unit !== null && scope.units.includes(unit);
}

export function allowedUnitStorageValues(scope: ResolvedUnitScope): string[] | undefined {
  if (scope.unrestricted) return undefined;
  return scope.units.flatMap(unitStorageVariants);
}
