import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_GOODS_TYPE = "GENERAL CONSUMABLES";

function assertSafePrefix(prefix: string): string {
  const p = prefix.trim();
  // Live examples: PO/GC-J, PO/TR-J, PO/PM-J, PO/CG-J, PO/SS-J, PO/OC-A
  if (!/^PO\/[A-Z0-9]{1,6}-[A-Z]$/i.test(p)) {
    throw new Error(`Unexpected PO prefix format: ${p}`);
  }
  return p;
}

/**
 * ERP PO numbering (inspected live):
 * - Format: `{PO_PREFIX}{NNNN}` e.g. `PO/GC-J0317`
 * - Prefix from `OTHER_TOOLS_TYPE.PO_PREFIX` (year letter embedded; updated annually)
 * - Tools-linked POs overwhelmingly use GENERAL CONSUMABLES → `PO/GC-J`
 * - No sequence table — ERP allocates MAX(suffix)+1 for that prefix
 * - COMMON_PURCHASE_ITEM.ROW_ID is NOT IDENTITY — allocate MAX(ROW_ID)+1
 */
export async function resolvePoPrefix(goodsType?: string | null): Promise<{
  goodsType: string;
  prefix: string;
}> {
  const wanted = (goodsType ?? DEFAULT_GOODS_TYPE).trim() || DEFAULT_GOODS_TYPE;
  const row =
    (await prisma.otherToolsType.findFirst({
      where: { otherType: wanted },
      select: { otherType: true, poPrefix: true },
    })) ??
    (await prisma.otherToolsType.findFirst({
      where: { otherType: DEFAULT_GOODS_TYPE },
      select: { otherType: true, poPrefix: true },
    }));

  const prefix = assertSafePrefix(row?.poPrefix ?? "PO/GC-J");
  return {
    goodsType: row?.otherType?.trim() || wanted,
    prefix,
  };
}

function padSeq(n: number, width = 4): string {
  return String(n).padStart(width, "0");
}

/**
 * Allocate next PO_ORDER_NO for a prefix inside a transaction (UPDLOCK).
 */
export async function allocateNextPoOrderNo(
  tx: Prisma.TransactionClient,
  prefixRaw: string
): Promise<string> {
  const prefix = assertSafePrefix(prefixRaw);
  const escaped = prefix.replace(/'/g, "''");
  const rows = await tx.$queryRawUnsafe<Array<{ max_seq: number | null }>>(
    `SELECT MAX(TRY_CAST(SUBSTRING(PO_ORDER_NO, ${prefix.length + 1}, 16) AS INT)) AS max_seq
     FROM dbo.COMMON_PURCHASE_ORDER WITH (UPDLOCK, HOLDLOCK)
     WHERE PO_ORDER_NO LIKE N'${escaped}%'`
  );

  const maxSeq = Number(rows[0]?.max_seq ?? 0);
  const poOrderNo = `${prefix}${padSeq(maxSeq + 1)}`;
  if (poOrderNo.length > 16) {
    throw new Error(`Generated PO number exceeds 16 chars: ${poOrderNo}`);
  }

  const clash = await tx.commonPurchaseOrder.findUnique({
    where: { poOrderNo },
    select: { poOrderNo: true },
  });
  if (clash) {
    throw new Error(`PO number collision for ${poOrderNo}`);
  }
  return poOrderNo;
}

/** Allocate N consecutive COMMON_PURCHASE_ITEM.ROW_ID values. */
export async function allocateItemRowIds(
  tx: Prisma.TransactionClient,
  count: number
): Promise<number[]> {
  if (count <= 0) return [];
  const rows = await tx.$queryRawUnsafe<Array<{ max_row: number | null }>>(
    `SELECT MAX(ROW_ID) AS max_row FROM dbo.COMMON_PURCHASE_ITEM WITH (UPDLOCK, HOLDLOCK)`
  );
  let next = Number(rows[0]?.max_row ?? 0) + 1;
  const ids: number[] = [];
  for (let i = 0; i < count; i++) ids.push(next++);
  return ids;
}

/**
 * TOOLS_PO_RECEIVE.GIR_NO is NOT IDENTITY — allocate MAX+1 (UPDLOCK).
 * Display series GIR_NO_NEW uses independent GRN/GC-J#### suffix.
 */
export async function allocateNextGirNo(
  tx: Prisma.TransactionClient
): Promise<{ girNo: number; girNoNew: string }> {
  const rows = await tx.$queryRawUnsafe<Array<{ max_gir: number | null }>>(
    `SELECT MAX(GIR_NO) AS max_gir FROM dbo.TOOLS_PO_RECEIVE WITH (UPDLOCK, HOLDLOCK)`
  );
  const girNo = Number(rows[0]?.max_gir ?? 0) + 1;

  const prefix = "GRN/GC-J";
  const seqRows = await tx.$queryRawUnsafe<Array<{ max_seq: number | null }>>(
    `SELECT MAX(TRY_CAST(SUBSTRING(GIR_NO_NEW, ${prefix.length + 1}, 16) AS INT)) AS max_seq
     FROM dbo.TOOLS_PO_RECEIVE WITH (UPDLOCK, HOLDLOCK)
     WHERE GIR_NO_NEW LIKE N'GRN/GC-J%'`
  );
  const seq = Number(seqRows[0]?.max_seq ?? 0) + 1;
  const girNoNew = `${prefix}${padSeq(seq)}`;

  return { girNo, girNoNew: girNoNew.slice(0, 20) };
}

/** Allocate N consecutive TOOLS_PO_RECEIVE_TRANS.ROW_ID values (not IDENTITY). */
export async function allocateGrnTransRowIds(
  tx: Prisma.TransactionClient,
  count: number
): Promise<number[]> {
  if (count <= 0) return [];
  const rows = await tx.$queryRawUnsafe<Array<{ max_row: number | null }>>(
    `SELECT MAX(ROW_ID) AS max_row FROM dbo.TOOLS_PO_RECEIVE_TRANS WITH (UPDLOCK, HOLDLOCK)`
  );
  let next = Number(rows[0]?.max_row ?? 0) + 1;
  const ids: number[] = [];
  for (let i = 0; i < count; i++) ids.push(next++);
  return ids;
}

export { DEFAULT_GOODS_TYPE };
