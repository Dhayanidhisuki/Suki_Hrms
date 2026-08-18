export const COMPANY_UNITS = [
  { key: "UNIT1", label: "Unit 1" },
  { key: "UNIT2", label: "Unit 2" },
  { key: "UNIT3", label: "Unit 3" },
] as const;

export type CompanyUnitKey = (typeof COMPANY_UNITS)[number]["key"];
export type CompanyUnitLabel = (typeof COMPANY_UNITS)[number]["label"];

export function normalizeCompanyUnit(value: string | null | undefined): CompanyUnitLabel | null {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");
  const match = COMPANY_UNITS.find(
    (unit) => normalized === unit.key || normalized === unit.label.toUpperCase().replace(/\s+/g, "")
  );
  return match?.label ?? null;
}

export function unitStorageVariants(label: CompanyUnitLabel): string[] {
  const number = label.slice(-1);
  return [label, `Unit-${number}`, `UNIT${number}`];
}

export function scopeKeyToUnit(scope: string): CompanyUnitLabel | null {
  return normalizeCompanyUnit(scope);
}
