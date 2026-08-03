import { readFile } from "fs/promises";
import path from "path";

export type EsskayPricingRow = {
  id: number;
  rowId: number;
  supCode: string | null;
  toolRefNo: number | null;
  toolOrGaugeNo: string | null;
  toolName: string | null;
  grouping: string | null;
  revNo: string | null;
  revDate: string | null;
  revStatus: string | null;
  approvalStatus: string | null;
  approvalDate: string | null;
  currency: string | null;
  rate: number | null;
  remarks: string | null;
  vendorType: string | null;
  subCode: string | null;
  toolMapRefNo: number | null;
  creatUserIdCd: string | null;
  creatDt: string | null;
  lstUpdtUserIdCd: string | null;
  lstUpdtTs: string | null;
  companyId: number | null;
  source?: string;
};

type EsskayPricingFile = {
  source: string;
  exportedAt: string;
  count: number;
  items: EsskayPricingRow[];
};

let cache: EsskayPricingFile | null = null;

/** Temporary read-only load of ESSKAY TOOLS_PRICE_MASTER export (Manpro table is empty). */
export async function loadEsskayPricing(): Promise<EsskayPricingFile> {
  if (cache) return cache;

  const filePath = path.join(process.cwd(), "data", "esskay-tools-price-master.json");
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as EsskayPricingFile;
  cache = parsed;
  return parsed;
}
