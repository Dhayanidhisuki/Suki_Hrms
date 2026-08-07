/** Shared mapping for Subcontractor master API responses. */
export type SubUiStatus = "Active" | "Inactive" | "Blocked";

export function mapSubUiStatus(v: string | null | undefined): SubUiStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BLOCKED") return "Blocked";
  if (s === "INACTIVE" || s === "IN ACTIVE" || s === "IN-ACTIVE" || s === "I") return "Inactive";
  return "Active";
}

export function toErpSubStatus(ui: string | null | undefined): string | undefined {
  if (ui == null || ui === "") return undefined;
  if (ui === "Blocked" || ui === "BLOCKED") return "BLOCKED";
  if (ui === "Inactive" || ui === "INACTIVE") return "INACTIVE";
  if (ui === "Active" || ui === "ACTIVE") return "ACTIVE";
  return String(ui).slice(0, 15);
}

function yesNo(v: string | null | undefined): boolean {
  return String(v ?? "").trim().toUpperCase() === "YES" || String(v ?? "").trim().toUpperCase() === "Y";
}

export function mapSubcontractorRow(item: {
  subConId: string;
  subName: string | null;
  natureOfWork: string | null;
  gstin: string | null;
  add1: string | null;
  add2: string | null;
  isStoreVendor: string | null;
  isInhouse: string | null;
  isIssueDc: string | null;
  approvedSubcontractor: string | null;
  status: string | null;
  creatUserIdCd: string | null;
  creatDt: Date | null;
  lstUpdtUserIdCd?: string | null;
}) {
  const approved =
    (item.approvedSubcontractor ?? "").toUpperCase() === "YES" ||
    (item.approvedSubcontractor ?? "").toUpperCase() === "Y";

  return {
    id: item.subConId,
    subCode: item.subConId,
    subName: item.subName ?? "",
    natureOfWork: item.natureOfWork ?? "",
    gstin: item.gstin,
    add1: item.add1,
    add2: item.add2,
    address: [item.add1, item.add2].filter(Boolean).join(", ") || null,
    isStoreVendor: yesNo(item.isStoreVendor),
    isInhouse: yesNo(item.isInhouse),
    isIssueDC: yesNo(item.isIssueDc),
    isApproved: approved,
    status: mapSubUiStatus(item.status),
    erpStatus: item.status,
    creatUserIdCd: item.creatUserIdCd ?? "",
    creatDt: item.creatDt,
    lstUpdtUserIdCd: item.lstUpdtUserIdCd ?? null,
  };
}

export function ynFromBody(v: unknown): "Yes" | "No" {
  if (v === true || v === "Yes" || v === "Y" || v === "yes") return "Yes";
  return "No";
}
