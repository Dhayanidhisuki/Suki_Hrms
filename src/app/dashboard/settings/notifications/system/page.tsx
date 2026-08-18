"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/apiClient";
import { toastError, toastSuccess } from "@/lib/appToast";

type Item = { id: number; toolOrGaugeNo: string; unitCode: string | null; dueDate: string; subject: string; message: string; readAt: string | null };
export default function SystemNotificationsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const load = async () => { const res = await apiGet<{ items: Item[] }>("/api/notifications/calibration"); if (res.data) setItems(res.data.items); };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  const generate = async () => { const res = await apiPost<{ created: number }>("/api/notifications/calibration", {}); if (res.error) return toastError(res.error.message); toastSuccess(`${res.data?.created ?? 0} new reminder(s) generated.`); await load(); };
  return <div className="flex h-screen bg-[var(--bg-app)]"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><TopBar /><main className="flex-1 overflow-y-auto px-7 py-6"><div className="mb-5 flex items-center justify-between"><div><h1 className="text-2xl font-bold">System Notifications</h1><p className="text-sm text-[var(--text-muted)]">Calibration reminders generated from unit-wise next due dates.</p></div><Button onClick={generate}>Run Reminder Check</Button></div><div className="space-y-3">{items.map((item) => <article key={item.id} className={`rounded-xl border p-4 ${item.readAt ? "border-[var(--border-main)] bg-[var(--bg-card)]" : "border-amber-300 bg-amber-50"}`}><div className="flex justify-between gap-4"><div><h2 className="font-semibold">{item.subject}</h2><p className="mt-1 text-sm">{item.message}</p></div><span className="whitespace-nowrap text-xs">Due {item.dueDate.slice(0, 10)}</span></div></article>)}{!items.length && <p className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-10 text-center text-[var(--text-muted)]">No reminders generated.</p>}</div></main></div></div>;
}
