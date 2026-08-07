"use client";

export type UnitHistoryTableRow = {
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

const COLS = [
  "S.N",
  "Status",
  "Purchase Dt",
  "Purchase At",
  "Make",
  "MFG Serial No.",
  "Lst.Cali.Dt",
  "Nxt.Cali.Dt",
  "Lst PreMNT.Dt",
  "Nxt PreMNT.Dt",
  "Lst Pre.MNT Done",
  "Nxt Pre.MNT Done",
  "PreMNT Present Status",
  "Issue To",
  "Dc No",
  "Dc Date",
  "PM",
] as const;

function cell(v: string | null | undefined) {
  return v && v !== "" ? v : "—";
}

function toIsoDate(value: string | null | undefined): string {
  if (!value || value === "—") return "";
  const str = String(value).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * ERP toolsmanagecreation unit grid — fully inline editable columns when onUpdateUnitProp is passed.
 * Data from GAUGE_SERIAL_NO + calib/issue enrichment.
 */
export function UnitHistoryTable({
  rows,
  onCompletePm,
  onUpdatePurchaseDt,
  onUpdateUnitProp,
  emptyLabel = "No records found.",
}: {
  rows: UnitHistoryTableRow[];
  onCompletePm?: (unitRefNo: number) => void;
  onUpdatePurchaseDt?: (refNo: number | undefined, key: string, newDate: string) => void;
  onUpdateUnitProp?: (
    refNo: number | undefined,
    key: string,
    field: keyof UnitHistoryTableRow,
    value: string,
    row?: UnitHistoryTableRow
  ) => void;
  emptyLabel?: string;
}) {
  const handleFieldChange = (
    row: UnitHistoryTableRow,
    field: keyof UnitHistoryTableRow,
    val: string
  ) => {
    if (onUpdateUnitProp) {
      onUpdateUnitProp(row.refNo, row.key, field, val, row);
    } else if (field === "purchaseDt" && onUpdatePurchaseDt) {
      onUpdatePurchaseDt(row.refNo, row.key, val);
    }
  };

  const isEditable = Boolean(onUpdateUnitProp || onUpdatePurchaseDt);

  return (
    <div className="overflow-x-auto border border-[var(--border-main)] rounded-xl">
      <table className="w-full text-xs min-w-[1500px]">
        <thead>
          <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
            {COLS.map((col) => (
              <th
                key={col}
                className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-2.5 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-main)]">
          {rows.map((row, idx) => (
            <tr key={row.key || idx} className="hover:bg-[var(--bg-hover)]">
              <td className="py-2.5 px-2.5 font-mono font-semibold">{idx + 1}</td>

              {/* Status */}
              <td className="py-2.5 px-2.5 whitespace-nowrap">
                {isEditable ? (
                  <select
                    value={row.status || "AVAILABLE FOR USE"}
                    onChange={(e) => handleFieldChange(row, "status", e.target.value)}
                    className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer"
                  >
                    <option value="AVAILABLE FOR USE">AVAILABLE FOR USE</option>
                    <option value="Issued">Issued</option>
                    <option value="ISSUE FOR CALIBRATION">ISSUE FOR CALIBRATION</option>
                    <option value="Under Repair">Under Repair</option>
                    <option value="Scrapped">Scrapped</option>
                  </select>
                ) : (
                  cell(row.status)
                )}
              </td>

              {/* Purchase Dt — past dates allowed (no min) */}
              <td className="py-2.5 px-2.5 font-mono whitespace-nowrap">
                {isEditable ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={toIsoDate(row.purchaseDt)}
                      onChange={(e) => handleFieldChange(row, "purchaseDt", e.target.value)}
                      className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] hover:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-colors cursor-pointer"
                      title="Purchase date (past dates allowed)"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split("T")[0];
                        handleFieldChange(row, "purchaseDt", today);
                      }}
                      className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-[var(--primary-light)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors cursor-pointer shadow-xs active:scale-95"
                      title="Set Purchase Date to Today"
                    >
                      Today
                    </button>
                  </div>
                ) : (
                  cell(row.purchaseDt)
                )}
              </td>

              {/* Purchase At */}
              <td className="py-2.5 px-2.5 whitespace-nowrap">
                {onUpdateUnitProp ? (
                  <input
                    type="text"
                    placeholder="Vendor / Store"
                    value={row.purchaseAt && row.purchaseAt !== "—" ? row.purchaseAt : ""}
                    onChange={(e) => handleFieldChange(row, "purchaseAt", e.target.value)}
                    className="w-28 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] hover:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none font-mono"
                  />
                ) : (
                  cell(row.purchaseAt)
                )}
              </td>

              {/* Make */}
              <td className="py-2.5 px-2.5 whitespace-nowrap">
                {onUpdateUnitProp ? (
                  <input
                    type="text"
                    placeholder="Make / Brand"
                    value={row.make && row.make !== "—" ? row.make : ""}
                    onChange={(e) => handleFieldChange(row, "make", e.target.value)}
                    className="w-28 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] hover:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                ) : (
                  cell(row.make)
                )}
              </td>

              {/* MFG Serial No */}
              <td className="py-2.5 px-2.5 font-mono font-semibold whitespace-nowrap">
                {onUpdateUnitProp ? (
                  <input
                    type="text"
                    placeholder="Serial No"
                    value={row.serialNo && row.serialNo !== "—" ? row.serialNo : ""}
                    onChange={(e) => handleFieldChange(row, "serialNo", e.target.value)}
                    className="w-24 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] hover:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                ) : (
                  cell(row.serialNo)
                )}
              </td>

              {/* Lst Cali Dt */}
              <td className="py-2.5 px-2.5 font-mono whitespace-nowrap">
                {onUpdateUnitProp ? (
                  <input
                    type="date"
                    value={toIsoDate(row.lastCaliDt)}
                    onChange={(e) => handleFieldChange(row, "lastCaliDt", e.target.value)}
                    className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] hover:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer"
                    title="Last Calibration Date (updates Next Calib Date automatically)"
                  />
                ) : (
                  cell(row.lastCaliDt)
                )}
              </td>

              {/* Nxt Cali Dt */}
              <td className="py-2.5 px-2.5 font-mono whitespace-nowrap">
                {onUpdateUnitProp ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={toIsoDate(row.nextCaliDt)}
                      onChange={(e) => handleFieldChange(row, "nextCaliDt", e.target.value)}
                      className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] hover:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer"
                      title="Next Calibration Date (auto-calculated from frequency or manually editable)"
                    />
                    {row.nextCaliDt && row.nextCaliDt !== "—" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {toIsoDate(row.nextCaliDt) || row.nextCaliDt}
                      </span>
                    )}
                  </div>
                ) : row.nextCaliDt && row.nextCaliDt !== "—" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-xs">
                    {toIsoDate(row.nextCaliDt) || row.nextCaliDt}
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">—</span>
                )}
              </td>

              {/* Lst PreMnt Dt */}
              <td className="py-2.5 px-2.5 font-mono whitespace-nowrap">
                {onUpdateUnitProp ? (
                  <input
                    type="date"
                    value={toIsoDate(row.lastPreMntDt)}
                    onChange={(e) => handleFieldChange(row, "lastPreMntDt", e.target.value)}
                    className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] hover:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer"
                  />
                ) : (
                  cell(row.lastPreMntDt)
                )}
              </td>

              {/* Nxt PreMnt Dt */}
              <td className="py-2.5 px-2.5 font-mono whitespace-nowrap">
                {onUpdateUnitProp ? (
                  <input
                    type="date"
                    value={toIsoDate(row.nextPreMntDt)}
                    onChange={(e) => handleFieldChange(row, "nextPreMntDt", e.target.value)}
                    className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] hover:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer"
                  />
                ) : (
                  cell(row.nextPreMntDt)
                )}
              </td>

              <td className="py-2.5 px-2.5 whitespace-nowrap">{cell(row.lastPreMntDone)}</td>
              <td className="py-2.5 px-2.5 whitespace-nowrap">{cell(row.nextPreMntDone)}</td>
              <td className="py-2.5 px-2.5 whitespace-nowrap">{cell(row.preMntPresentStatus)}</td>
              <td className="py-2.5 px-2.5 whitespace-nowrap">
                {row.dcNo && row.dcNo !== "—"
                  ? cell(row.issueTo)
                  : row.issueTo && row.issueTo !== "—"
                    ? row.issueTo
                    : "In store"}
              </td>
              <td className="py-2.5 px-2.5 font-mono whitespace-nowrap">{cell(row.dcNo)}</td>
              <td className="py-2.5 px-2.5 font-mono whitespace-nowrap">{cell(row.dcDate)}</td>
              <td className="py-2.5 px-2.5 whitespace-nowrap">
                {onCompletePm && row.refNo ? (
                  <button
                    type="button"
                    onClick={() => onCompletePm(row.refNo!)}
                    className="text-[11px] font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    Complete PM
                  </button>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={COLS.length}
                className="py-8 text-center text-sm text-[var(--text-muted)]"
              >
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
