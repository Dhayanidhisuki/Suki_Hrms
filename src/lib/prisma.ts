import { Prisma, PrismaClient } from "@prisma/client";

// Prevent multiple PrismaClient instances in Next.js development hot-reload.
// After `prisma generate` adds models/fields, a cached global client can be stale
// (missing delegates or Unknown argument on new fields).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  schemaStamp: string | undefined;
};

/**
 * Changes when GaugeAndTools fields are regenerated — forces a new client.
 * Bump CLIENT_REV after `prisma generate` if Next still serves a stale client.
 */
const CLIENT_REV = "instrument-master-data-2026-08-14-v8";
const SCHEMA_STAMP = `${CLIENT_REV}:${Object.keys(Prisma.GaugeAndToolsScalarFieldEnum).sort().join(",")}`;

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function hasRequiredDelegates(client: PrismaClient): boolean {
  const c = client as {
    materialRequisitionTrans?: { findMany?: unknown };
    commonPurchaseOrder?: { findMany?: unknown; count?: unknown };
    purchaseApproval?: { findMany?: unknown };
    rolePermission?: { findMany?: unknown };
    toolsPoFinance?: { findMany?: unknown };
    toolsUnitMaster?: { findMany?: unknown };
    toolsUnitStock?: { findMany?: unknown };
    authorizedCalibrationAgency?: { findMany?: unknown };
    instrumentDefect?: { findMany?: unknown };
    instrumentServiceRecord?: { findMany?: unknown };
    calibrationDeviation?: { findMany?: unknown };
    calibrationNotificationSetting?: { findUnique?: unknown };
    calibrationNotificationRecipient?: { findMany?: unknown };
    calibrationNotification?: { findMany?: unknown };
    instrumentImportedMasterData?: { upsert?: unknown; findMany?: unknown };
  };
  return (
    typeof c.materialRequisitionTrans?.findMany === "function" &&
    typeof c.commonPurchaseOrder?.findMany === "function" &&
    typeof c.commonPurchaseOrder?.count === "function" &&
    typeof c.purchaseApproval?.findMany === "function" &&
    typeof c.rolePermission?.findMany === "function" &&
    typeof c.toolsPoFinance?.findMany === "function" &&
    typeof c.toolsUnitMaster?.findMany === "function" &&
    typeof c.toolsUnitStock?.findMany === "function" &&
    typeof c.authorizedCalibrationAgency?.findMany === "function" &&
    typeof c.instrumentDefect?.findMany === "function" &&
    typeof c.instrumentServiceRecord?.findMany === "function" &&
    typeof c.calibrationDeviation?.findMany === "function" &&
    typeof c.calibrationNotificationSetting?.findUnique === "function" &&
    typeof c.calibrationNotificationRecipient?.findMany === "function" &&
    typeof c.calibrationNotification?.findMany === "function" &&
    typeof c.instrumentImportedMasterData?.upsert === "function" &&
    typeof c.instrumentImportedMasterData?.findMany === "function"
  );
}

function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const stampOk = globalForPrisma.schemaStamp === SCHEMA_STAMP;
  if (existing && stampOk && hasRequiredDelegates(existing)) return existing;
  // Never disconnect a previous development client here: another request may
  // still own an interactive transaction on it. Immediate disconnect caused
  // "Transaction not found" and empty engine responses during hot reload.
  // The old instance becomes unreachable and exits with the dev process.
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.schemaStamp = SCHEMA_STAMP;
  }
  return client;
}

/**
 * Resolve through getPrisma() so a post-`prisma generate` hot reload
 * replaces a stale singleton. Use the real client as `this` for Prisma getters.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
