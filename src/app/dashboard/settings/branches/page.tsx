"use client";

import { useEffect, useState } from "react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet } from "@/lib/apiClient";

interface BranchPayload {
  locations: Array<{
    ROW_ID: number;
    LOCATION_TYPE: string | null;
    LOCATION_NAME: string | null;
    RACK: string | null;
    AREA: string | null;
  }>;
  companyIds: string[];
  fromUnits: string[];
}

export default function BranchSettingsPage() {
  const [data, setData] = useState<BranchPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await apiGet<BranchPayload>("/api/settings/branches");
      setData(res.data ?? { locations: [], companyIds: [], fromUnits: [] });
      setLoading(false);
    })();
  }, []);

  return (
    <SimpleMasterShell
      title="Branch Settings"
      subtitle="LOCATION_MASTER (Item/Asset) with COMPANY_ID / FROM_UNIT usage — read/filter view"
    >
      {loading ? (
        <TableSkeleton rows={4} />
      ) : (
        <div className="space-y-6">
          <div className="form-grid">
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
              <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">GAUGEANDTOOLS.COMPANY_ID values</h2>
              <div className="flex flex-wrap gap-2">
                {(data?.companyIds ?? []).map((id) => (
                  <span key={id} className="px-2.5 py-1 rounded-lg text-xs bg-[var(--bg-subtle)] border border-[var(--border-main)] font-mono">
                    {id}
                  </span>
                ))}
                {(data?.companyIds ?? []).length === 0 && (
                  <span className="text-sm text-[var(--text-muted)]">No values</span>
                )}
              </div>
            </div>
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
              <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">GAUGE_TOOLS_ISSUE.FROM_UNIT values</h2>
              <div className="flex flex-wrap gap-2">
                {(data?.fromUnits ?? []).map((id) => (
                  <span key={id} className="px-2.5 py-1 rounded-lg text-xs bg-[var(--bg-subtle)] border border-[var(--border-main)] font-mono">
                    {id}
                  </span>
                ))}
                {(data?.fromUnits ?? []).length === 0 && (
                  <span className="text-sm text-[var(--text-muted)]">No values</span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">LOCATION_MASTER (Item/Asset)</h2>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {["ID", "Location Name", "Type", "Area", "Rack"].map((col) => (
                      <th key={col} className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {(data?.locations ?? []).map((loc) => (
                    <tr key={loc.ROW_ID} className="hover:bg-[var(--bg-hover)]">
                      <td className="py-3 px-3 font-mono text-xs">{loc.ROW_ID}</td>
                      <td className="py-3 px-3">{loc.LOCATION_NAME ?? "—"}</td>
                      <td className="py-3 px-3 text-[var(--text-muted)]">{loc.LOCATION_TYPE ?? "—"}</td>
                      <td className="py-3 px-3 text-[var(--text-muted)]">{loc.AREA ?? "—"}</td>
                      <td className="py-3 px-3 text-[var(--text-muted)]">{loc.RACK ?? "—"}</td>
                    </tr>
                  ))}
                  {(data?.locations ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-[var(--text-muted)]">
                        No Item/Asset locations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </SimpleMasterShell>
  );
}
