/** Shared mapping for Supplier master API responses. */
export type SupplierUiStatus = "Active" | "Inactive" | "Blocked";

export function mapSupplierUiStatus(v: string | null | undefined): SupplierUiStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BLOCKED") return "Blocked";
  if (s === "INACTIVE" || s === "IN ACTIVE" || s === "IN-ACTIVE" || s === "I") return "Inactive";
  return "Active";
}

export function toErpSupplierStatus(ui: string | null | undefined): string | undefined {
  if (ui == null || ui === "") return undefined;
  if (ui === "Blocked" || ui === "BLOCKED") return "BLOCKED";
  if (ui === "Inactive" || ui === "INACTIVE") return "INACTIVE";
  if (ui === "Active" || ui === "ACTIVE") return "ACTIVE";
  return String(ui).slice(0, 15);
}

export function mapSupplierRow(s: {
  supCode: string;
  supName: string | null;
  add1: string | null;
  city: string | null;
  state: string | null;
  phone1: string | null;
  emailId: string | null;
  gstin: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  approvedSupplier: string | null;
  status: string | null;
  creatUserIdCd: string;
  creatDt: Date | null;
  lstUpdtUserIdCd?: string | null;
}) {
  const approved =
    (s.approvedSupplier ?? "").toUpperCase() === "YES" ||
    (s.approvedSupplier ?? "").toUpperCase() === "Y";

  return {
    id: s.supCode,
    supCode: s.supCode,
    supName: s.supName ?? "",
    address: s.add1,
    city: s.city,
    state: s.state,
    phone: s.phone1,
    email: s.emailId,
    gstin: s.gstin,
    bankName: s.bankName,
    accountNumber: s.accountNumber,
    ifscCode: s.ifscCode,
    status: mapSupplierUiStatus(s.status),
    erpStatus: s.status,
    isApproved: approved,
    creatUserIdCd: s.creatUserIdCd,
    creatDt: s.creatDt,
    lstUpdtUserIdCd: s.lstUpdtUserIdCd ?? null,
  };
}

export function normalizeSupplierBody(body: Record<string, unknown>, id?: string) {
  return {
    ...(id ? { supCode: id } : { supCode: body.supCode }),
    supName: body.supName,
    add1: body.add1 ?? body.address,
    city: body.city,
    state: body.state,
    gstin: body.gstin,
    phone1: body.phone1 ?? body.phone,
    emailId: body.emailId ?? body.email ?? "",
    bankName: body.bankName,
    accountNumber: body.accountNumber,
    ifscCode: body.ifscCode,
    approvedSupplier:
      body.approvedSupplier ??
      (body.isApproved === true ? "Yes" : body.isApproved === false ? "No" : undefined),
    status: toErpSupplierStatus(
      typeof body.status === "string" ? body.status : undefined
    ),
  };
}
