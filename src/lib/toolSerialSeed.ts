import type { Prisma, PrismaClient } from "@prisma/client";
import { computeNextPreDate, isAssetYes } from "@/lib/preventiveFlow";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Ensure GAUGE_SERIAL_NO has one row per Total Qty when serial generation is on.
 * Only adds missing units (never deletes) — matches ERP create/edit behaviour.
 */
export async function seedSerialsToMatchTotQty(
  db: Db,
  opts: {
    toolRefNo: number;
    toolOrGaugeNo: string | null | undefined;
    totQty: number | string | null | undefined;
    userId: string;
    isAsset?: string | null;
    preventiveFrqMonths?: number | null;
    purchaseDt?: string | Date | null;
  }
): Promise<number> {
  const toolNo = (opts.toolOrGaugeNo ?? "").trim();
  const target = Math.floor(Number(opts.totQty) || 0);
  if (!toolNo || target <= 0) return 0;

  let purchaseDate: Date | null = null;
  if (opts.purchaseDt) {
    const d = new Date(opts.purchaseDt);
    if (!isNaN(d.getTime())) purchaseDate = d;
  }

  const existing = await db.gaugeSerialNo.findMany({
    where: {
      OR: [{ toolOrGaugeNo: toolNo }, { toolRefNo: opts.toolRefNo }],
    },
    select: { refNo: true, serialNo: true, purchaseDt: true },
  });

  // If purchaseDate is provided and existing units have no purchaseDt, update them
  if (purchaseDate && existing.some((s) => s.purchaseDt == null)) {
    await db.gaugeSerialNo.updateMany({
      where: {
        AND: [
          { OR: [{ toolOrGaugeNo: toolNo }, { toolRefNo: opts.toolRefNo }] },
          { purchaseDt: null },
        ],
      },
      data: { purchaseDt: purchaseDate },
    });
  }

  const have = existing.length;
  if (have >= target) return 0;

  const maxSerialNo = existing.reduce((m, s) => Math.max(m, s.serialNo ?? 0), 0);
  const maxRef =
    (await db.gaugeSerialNo.aggregate({ _max: { refNo: true } }))._max.refNo ??
    opts.toolRefNo * 1000;

  const seedPre =
    isAssetYes(opts.isAsset) || (opts.preventiveFrqMonths ?? 0) > 0
      ? computeNextPreDate({
          frequencyMonths:
            opts.preventiveFrqMonths && opts.preventiveFrqMonths > 0
              ? opts.preventiveFrqMonths
              : 6,
        })
      : null;

  const need = target - have;
  await db.gaugeSerialNo.createMany({
    data: Array.from({ length: need }, (_, i) => ({
      refNo: maxRef + i + 1,
      toolOrGaugeNo: toolNo,
      toolRefNo: opts.toolRefNo,
      serialNo: maxSerialNo + i + 1,
      status: "AVAILABLE FOR USE",
      purchaseDt: purchaseDate,
      nextPreDate: seedPre,
      creatUserIdCd: opts.userId.slice(0, 10),
      creatDt: new Date(),
    })),
  });
  return need;
}
