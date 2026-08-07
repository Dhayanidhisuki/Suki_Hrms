/** Map ERP Tools Specification dialog rows ↔ TOOLS_SPECIFICATION. */

export type ToolSpecInput = {
  sequence?: number | null;
  parameter?: string | null;
  specification?: string | null;
  minRange?: string | null;
  maxRange?: string | null;
  wLimitLowerMin?: number | null;
  wLimitLowerMax?: number | null;
  prodSpecLowerMin?: number | null;
  prodSpecLowerMax?: number | null;
  // legacy aliases
  specName?: string | null;
  specValue?: string | null;
  unit?: string | null;
};

export type ToolSpecPersistRow = {
  toolRefNo: number;
  sequence: number;
  parameter: string;
  specification: string | null;
  minRange: string | null;
  maxRange: string | null;
  wLimitLowerMin: number | null;
  wLimitLowerMax: number | null;
  prodSpecLowerMin: number | null;
  prodSpecLowerMax: number | null;
};

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

/** Normalize client payload rows for create/update. */
export function mapSpecInputsToPersist(
  toolRefNo: number,
  specifications: ToolSpecInput[] | undefined | null
): ToolSpecPersistRow[] {
  if (!specifications?.length) return [];
  return specifications
    .map((s, i) => {
      const parameter = strOrNull(s.parameter || s.specName, 50) ?? "";
      return {
        toolRefNo,
        sequence: s.sequence != null && Number.isFinite(Number(s.sequence)) ? Number(s.sequence) : i + 1,
        parameter,
        specification: strOrNull(s.specification || s.specValue, 100),
        minRange: strOrNull(s.minRange || s.unit, 15),
        maxRange: strOrNull(s.maxRange, 15),
        wLimitLowerMin: numOrNull(s.wLimitLowerMin),
        wLimitLowerMax: numOrNull(s.wLimitLowerMax),
        prodSpecLowerMin: numOrNull(s.prodSpecLowerMin),
        prodSpecLowerMax: numOrNull(s.prodSpecLowerMax),
      };
    })
    .filter((s) => s.parameter);
}
