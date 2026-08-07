"use client";

import type { ReactNode } from "react";

export type UnitHistoryCardRow = {
  key: string;
  refNo?: number;
  serialNo: string;
  status: string;
  make: string;
  purchaseDt: string;
  purchaseAt?: string;
  lastCaliDt: string;
  nextCaliDt: string;
  lastPreMntDt?: string;
  nextPreMntDt?: string;
  lastPreMntDone?: string;
  nextPreMntDone?: string;
  preMntPresentStatus?: string;
  issueTo?: string;
  dcNo?: string;
  dcDate?: string;
};

function Cell({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const v = value && value !== "" ? value : "—";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-[var(--text-primary)] font-medium break-words">{v}</p>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)]">
        {title}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

/**
 * ERP unit-grid fields as segregated cards (not one 16-column table).
 * Matches toolsmanagecreation serial/unit strip columns.
 */
export function UnitHistoryCards({
  rows,
  showCalibration = true,
  showPreventive = true,
  onCompletePm,
  emptyLabel = "No records found.",
}: {
  rows: UnitHistoryCardRow[];
  showCalibration?: boolean;
  showPreventive?: boolean;
  onCompletePm?: (unitRefNo: number) => void;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--text-muted)] border border-dashed border-[var(--border-main)] rounded-xl">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => {
        const issued =
          row.dcNo && row.dcNo !== "—"
            ? `${row.issueTo && row.issueTo !== "—" ? row.issueTo : "—"}`
            : row.issueTo && row.issueTo !== "—"
              ? row.issueTo
              : "In store";

        return (
          <div
            key={row.key || idx}
            className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-4 space-y-4"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-md">
                  S.N {idx + 1}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-main)]">
                  {row.status || "—"}
                </span>
                <span className="font-mono text-sm font-bold text-[var(--text-primary)] truncate">
                  MFG {row.serialNo || "—"}
                </span>
              </div>
              {onCompletePm && row.refNo ? (
                <button
                  type="button"
                  onClick={() => onCompletePm(row.refNo!)}
                  className="text-[11px] font-semibold text-[var(--primary)] hover:underline whitespace-nowrap"
                  title="Mark preventive MNT done and advance next due"
                >
                  Complete PM
                </button>
              ) : null}
            </div>

            <Group title="Purchase / identity">
              <Cell label="Purchase Dt" value={row.purchaseDt} />
              <Cell label="Purchase At" value={row.purchaseAt} />
              <Cell label="Make" value={row.make} />
              <Cell label="MFG Serial No." value={row.serialNo} />
              <Cell label="Status" value={row.status} />
            </Group>

            {showCalibration && (
              <Group title="Calibration">
                <Cell label="Lst.Cali.Dt" value={row.lastCaliDt} />
                <Cell label="Nxt.Cali.Dt" value={row.nextCaliDt} />
              </Group>
            )}

            {showPreventive && (
              <Group title="Preventive MNT">
                <Cell label="Lst PreMNT.Dt" value={row.lastPreMntDt} />
                <Cell label="Nxt PreMNT.Dt" value={row.nextPreMntDt} />
                <Cell label="Lst Pre.MNT Done" value={row.lastPreMntDone} />
                <Cell label="Nxt Pre.MNT Done" value={row.nextPreMntDone} />
                <Cell label="PreMNT Present Status" value={row.preMntPresentStatus} />
              </Group>
            )}

            <Group title="Issue / DC">
              <Cell label="Issue To" value={issued} />
              <Cell label="Dc No" value={row.dcNo} />
              <Cell label="Dc Date" value={row.dcDate} />
            </Group>
          </div>
        );
      })}
    </div>
  );
}
