import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function rollUpToolStock(tx: Tx, refNo: number, actor: string) {
  const totals = await tx.toolsUnitStock.aggregate({
    where: { refNo },
    _sum: {
      qtyTotal: true,
      qtyIn: true,
      qtyOut: true,
      qtyNew: true,
      qtyInUse: true,
    },
  });

  await tx.gaugeAndTools.update({
    where: { refNo },
    data: {
      totQty: totals._sum.qtyTotal ?? 0,
      qtyIn: totals._sum.qtyIn ?? 0,
      qtyOut: totals._sum.qtyOut ?? 0,
      qtyNew: totals._sum.qtyNew ?? 0,
      qtyInUse: totals._sum.qtyInUse ?? 0,
      lstUpdtUserIdCd: actor,
    },
  });
}

export async function issueFromUnit(
  tx: Tx,
  input: { refNo: number; unitCode: string; quantity: number; actor: string; singleItem?: boolean }
) {
  const stock = await tx.toolsUnitStock.findUnique({
    where: { refNo_unitCode: { refNo: input.refNo, unitCode: input.unitCode } },
  });
  if (!stock) {
    const newStock = await tx.toolsUnitStock.create({
      data: {
        refNo: input.refNo,
        unitCode: input.unitCode,
        qtyTotal: 1,
        qtyIn: 0,
        qtyOut: input.quantity,
        creatUserIdCd: input.actor,
        creatDt: new Date(),
      },
    });
    await rollUpToolStock(tx, input.refNo, input.actor);
    return newStock;
  }

  const currentIn = stock.qtyIn != null ? Number(stock.qtyIn) : 1;
  const currentOut = stock.qtyOut != null ? Number(stock.qtyOut) : 0;

  const available = input.singleItem
    ? (stock.qtyTotal == null || Number(stock.qtyTotal) > 0) && currentOut <= 0
    : currentIn >= input.quantity;

  if (!available && stock.qtyIn !== null && stock.qtyTotal !== null) {
    throw new Error(
      `Insufficient stock in ${input.unitCode}. Available: ${stock.qtyIn ?? 0}, requested: ${input.quantity}`
    );
  }

  await tx.toolsUnitStock.update({
    where: { id: stock.id },
    data: {
      ...(input.singleItem
        ? { qtyIn: 0, qtyOut: Math.max(1, currentOut + 1) }
        : { qtyIn: Math.max(0, currentIn - input.quantity), qtyOut: currentOut + input.quantity }),
      lstUpdtUserIdCd: input.actor,
      lstUpdtTs: new Date(),
    },
  });
  await rollUpToolStock(tx, input.refNo, input.actor);
}

export async function receiveIntoUnit(
  tx: Tx,
  input: {
    refNo: number;
    sourceUnit: string;
    destinationUnit: string;
    quantity: number;
    actor: string;
  }
) {
  const source = await tx.toolsUnitStock.findUnique({
    where: { refNo_unitCode: { refNo: input.refNo, unitCode: input.sourceUnit } },
  });
  if (!source || Number(source.qtyOut ?? 0) < input.quantity) {
    throw new Error(
      `In-transit stock in ${input.sourceUnit} is less than receive quantity ${input.quantity}`
    );
  }

  if (input.sourceUnit === input.destinationUnit) {
    await tx.toolsUnitStock.update({
      where: { id: source.id },
      data: {
        qtyIn: { increment: input.quantity },
        qtyOut: { decrement: input.quantity },
        lstUpdtUserIdCd: input.actor,
        lstUpdtTs: new Date(),
      },
    });
  } else {
    await tx.toolsUnitStock.update({
      where: { id: source.id },
      data: {
        qtyTotal: { decrement: input.quantity },
        qtyOut: { decrement: input.quantity },
        lstUpdtUserIdCd: input.actor,
        lstUpdtTs: new Date(),
      },
    });
    await tx.toolsUnitStock.upsert({
      where: {
        refNo_unitCode: { refNo: input.refNo, unitCode: input.destinationUnit },
      },
      create: {
        refNo: input.refNo,
        unitCode: input.destinationUnit,
        qtyTotal: input.quantity,
        qtyIn: input.quantity,
        qtyOut: 0,
        qtyNew: 0,
        qtyInUse: 0,
        creatUserIdCd: input.actor,
        creatDt: new Date(),
      },
      update: {
        qtyTotal: { increment: input.quantity },
        qtyIn: { increment: input.quantity },
        lstUpdtUserIdCd: input.actor,
        lstUpdtTs: new Date(),
      },
    });
  }
  await rollUpToolStock(tx, input.refNo, input.actor);
}
