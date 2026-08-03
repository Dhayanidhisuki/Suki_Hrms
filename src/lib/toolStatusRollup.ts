/**
 * Per-tool status roll-up computed from GAUGE_SERIAL_NO unit rows.
 *
 * GAUGEANDTOOLS.STATUS is intentionally NOT used anywhere here — verified
 * against live ERP data it only ever holds NULL or 'Available' and carries
 * no lifecycle signal. The real state machine lives on GAUGE_SERIAL_NO.STATUS:
 * NEW PURCHASE -> INHOUSE USE / VENDOR USE -> ISSUE FOR CALIBRATION ->
 * AVAILABLE FOR USE / REJECTED / WORN OUT
 */

export const TOOL_ROLLUP_STATUSES = [
  "In Calibration",
  "Needs Attention",
  "Available",
  "In Use",
  "Inactive",
  "No Units",
] as const;

export type ToolRollupStatus = (typeof TOOL_ROLLUP_STATUSES)[number];

const CALIB = ["ISSUE FOR CALIBRATION"];
const ATTENTION = ["REJECTED", "WORN OUT"];
const AVAILABLE = ["AVAILABLE FOR USE"];
const IN_USE = ["INHOUSE USE", "VENDOR USE", "NEW PURCHASE"];
const ALL_TRACKED = [...CALIB, ...ATTENTION, ...AVAILABLE, ...IN_USE];

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Priority (confirmed against live data distribution): calibration and
 * attention states outrank Available because they are actionable; In Use
 * covers units in INHOUSE/VENDOR USE or NEW PURCHASE that would otherwise
 * incorrectly show as "No Units".
 */
export function computeToolRollupStatus(
  unitStatuses: Array<string | null | undefined>,
  activeItem: string | null | undefined
): ToolRollupStatus {
  const statuses = new Set(unitStatuses.map(norm));
  if (CALIB.some((s) => statuses.has(s))) return "In Calibration";
  if (ATTENTION.some((s) => statuses.has(s))) return "Needs Attention";
  if (AVAILABLE.some((s) => statuses.has(s))) return "Available";
  if (IN_USE.some((s) => statuses.has(s))) return "In Use";
  if (norm(activeItem) === "NO") return "Inactive";
  return "No Units";
}

/**
 * Prisma where fragment for GAUGEANDTOOLS that selects tools whose computed
 * roll-up equals the given badge. Mirrors computeToolRollupStatus so DB-level
 * filtering + pagination stay consistent with the badge shown per row.
 */
export function rollupStatusWhere(badge: string): Record<string, unknown> | null {
  const some = (values: string[]) => ({
    serialNumbers: { some: { status: { in: values } } },
  });
  const none = (values: string[]) => ({
    serialNumbers: { none: { status: { in: values } } },
  });

  switch (badge) {
    case "In Calibration":
      return some(CALIB);
    case "Needs Attention":
      return { AND: [some(ATTENTION), none(CALIB)] };
    case "Available":
      return { AND: [some(AVAILABLE), none([...CALIB, ...ATTENTION])] };
    case "In Use":
      return { AND: [some(IN_USE), none([...CALIB, ...ATTENTION, ...AVAILABLE])] };
    case "Inactive":
      return { AND: [none(ALL_TRACKED), { activeItem: "No" }] };
    case "No Units":
      return {
        AND: [
          none(ALL_TRACKED),
          { OR: [{ activeItem: null }, { activeItem: { not: "No" } }] },
        ],
      };
    default:
      return null;
  }
}
