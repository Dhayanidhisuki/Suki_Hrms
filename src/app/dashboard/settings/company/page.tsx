"use client";

import { useEffect, useState } from "react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet } from "@/lib/apiClient";

type Company = Record<string, unknown>;

export default function CompanySettingsPage() {
  const [items, setItems] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await apiGet<{ items: Company[] }>("/api/settings/company");
      setItems(res.data?.items ?? []);
      setLoading(false);
    })();
  }, []);

  const company = items[0];

  return (
    <SimpleMasterShell
      title="Company Settings"
      subtitle="COMPANY_DETAILS — organization profile used across Tools Management"
    >
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
        {loading ? (
          <TableSkeleton rows={4} />
        ) : !company ? (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">No company record found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {(
              [
                ["Company Name", String(company.COMPANY_NAME ?? company.DISP_COMPANY_NAME ?? "")],
                ["Short Name", String(company.SHORT_NAME ?? "")],
                ["Company ID", String(company.COMPANY_ID ?? "")],
                ["GSTIN", String(company.GSTIN ?? "")],
                ["Address", [company.ADD1, company.ADD2].filter(Boolean).join(", ")],
                ["City / State", [company.ADD2, company.STATE].filter(Boolean).join(" / ")],
                ["Pincode", String(company.PINCODE ?? "")],
                ["Phone", String(company.PHONE1 ?? "")],
                ["Email", String(company.EMAIL1 ?? "")],
                ["Website", String(company.WEB_SITE ?? "")],
                ["PAN", String(company.IT_PAN_NO ?? "")],
                ["Country", String(company.COUNTRY ?? "")],
              ] as Array<[string, string]>
            ).map(([label, value]) => (
              <div key={label} className="bg-[var(--bg-subtle)] rounded-xl p-3 border border-[var(--border-main)]">
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">{label}</p>
                <p className="mt-1 text-[var(--text-primary)]">{value || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </SimpleMasterShell>
  );
}
