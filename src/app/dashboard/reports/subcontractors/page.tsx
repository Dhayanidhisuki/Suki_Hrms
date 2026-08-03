"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Home, Store, FileText } from "lucide-react";
import { ReportHub } from "@/components/ReportHub";
import { ReportBarChart, ReportChartCard } from "@/components/ReportCharts";
import { apiGet } from "@/lib/apiClient";

type Sub = {
  subCode?: string;
  subName?: string;
  natureOfWork?: string | null;
  isInhouse?: boolean;
  isStoreVendor?: boolean;
  isIssueDC?: boolean;
  status?: string | null;
  gstin?: string | null;
};

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Sub[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiGet<{ items: Sub[] }>("/api/subcontractors");
      setItems(res.data?.items ?? []);
      setLoading(false);
    })();
  }, []);

  const active = items.filter((s) => s.status === "Active").length;
  const inhouse = items.filter((s) => s.isInhouse).length;
  const store = items.filter((s) => s.isStoreVendor).length;
  const dcIssue = items.filter((s) => s.isIssueDC).length;

  const capabilityChart = useMemo(
    () => [
      { name: "In-House", count: inhouse },
      { name: "Store Vendor", count: store },
      { name: "DC Issue", count: dcIssue },
    ],
    [inhouse, store, dcIssue]
  );

  return (
    <ReportHub
      title="Subcontractor Report"
      subtitle="Calibration labs and job-work vendors from SUBCONTRACTOR"
      kpis={[
        {
          id: "total",
          label: "Total Subcontractors",
          value: items.length,
          subtext: "Job-work & vendor partners",
          icon: Building2,
          iconBg: "bg-[var(--primary-light)]",
          iconColor: "text-[var(--primary)]",
          badge: { label: "Vendors", type: "info" },
        },
        {
          id: "active",
          label: "Active",
          value: active,
          subtext: "Ready for issue / DC",
          icon: FileText,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          badge: { label: "Active", type: "success" },
        },
        {
          id: "inhouse",
          label: "In-House",
          value: inhouse,
          subtext: "Internal job-work units",
          icon: Home,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: { label: "In-House", type: "info" },
        },
        {
          id: "store",
          label: "Store Vendors",
          value: store,
          subtext: "Store supply partners",
          icon: Store,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          badge: { label: "Store", type: "warning" },
        },
      ]}
      chart={
        <ReportChartCard
          title="Capability flags"
          subtitle="Counts by In-House / Store Vendor / DC Issue (flags can overlap)"
        >
          <ReportBarChart data={capabilityChart} />
        </ReportChartCard>
      }
      links={[
        {
          href: "/dashboard/masters/subcontractors",
          title: "Subcontractor Master",
          description: "Maintain lab codes, nature of work, GSTIN, and vendor flags.",
          icon: Building2,
          metric: items.length,
          metricLabel: "subcontractor records",
          badge: "Master",
        },
        {
          href: "/dashboard/calibration/issue",
          title: "Calibration Issue",
          description: "Issue tools to subcontractors / labs using SUB_CODE links.",
          icon: FileText,
          metricLabel: "Linked transaction",
          badge: "Calib",
        },
      ]}
      previewTitle="Subcontractor register preview"
      footerNote="Live rows from SUBCONTRACTOR. Open Subcontractor Master for full filters."
      previewLoading={loading}
      previewColumns={[
        { key: "subCode", label: "Code", mono: true },
        { key: "subName", label: "Name" },
        { key: "natureOfWork", label: "Nature of Work" },
        { key: "gstin", label: "GSTIN", mono: true },
        { key: "status", label: "Status" },
      ]}
      previewRows={items.slice(0, 100) as Record<string, unknown>[]}
      exportCategory="subcontractors"
    />
  );
}
