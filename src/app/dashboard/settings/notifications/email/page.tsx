"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, apiPut } from "@/lib/apiClient";
import { toastError, toastSuccess } from "@/lib/appToast";

type Recipient = { id: number; name: string; email: string; unitCode: string | null; isActive: boolean };
type PrimaryRecipient = { id: number; name: string; username: string; email: string | null; role: string | null; unitScopes: string[]; isActive: boolean; permissionEnabled: boolean; eligible: boolean; reason: string };
type Payload = { setting: { alertDays: number; emailEnabled: boolean; systemEnabled: boolean }; recipients: Recipient[]; primaryRecipients: PrimaryRecipient[] };
type SendResult = { sent?: number; skipped?: number; failed?: number; forced?: boolean; ok?: boolean; recipient?: string; subject?: string; error?: string };

function unitScopeLabel(scopes: string[]) {
  if (!scopes.length) return "No unit assigned";
  if (scopes.includes("COMMON")) return "All Units";
  return scopes.map((s) => s.replace(/^UNIT/, "Unit ")).join(", ");
}

export default function EmailNotificationSettingsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState({ name: "", email: "", unitCode: "", isActive: true });
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);

  const load = useCallback(async () => {
    const res = await apiGet<Payload>("/api/notifications/settings");
    if (res.data) setData(res.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const saveSettings = async () => {
    if (!data) return;
    const res = await apiPut("/api/notifications/settings", data.setting);
    if (res.error) return toastError(res.error.message);
    toastSuccess("Notification settings saved.");
  };

  const addRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiPost("/api/notifications/settings", form);
    if (res.error) return toastError(res.error.message);
    toastSuccess("Escalation CC added.");
    setForm({ name: "", email: "", unitCode: "", isActive: true });
    await load();
  };

  const toggle = async (item: Recipient) => {
    const res = await apiPost("/api/notifications/settings", { ...item, isActive: !item.isActive, unitCode: item.unitCode || "" });
    if (res.error) return toastError(res.error.message);
    await load();
  };

  /** Force-resend: POST to cron endpoint with session auth (no CRON_SECRET needed) */
  const forceResend = async () => {
    setSending(true);
    setLastResult(null);
    try {
      const res = await apiPost<SendResult>("/api/cron/calibration-notifications", {});
      if (res.error) {
        toastError(res.error.message);
      } else if (res.data) {
        setLastResult(res.data);
        const { sent = 0, skipped = 0, failed = 0 } = res.data;
        if (sent > 0) {
          toastSuccess(`✅ ${sent} digest email${sent !== 1 ? "s" : ""} sent successfully.`);
        } else if (failed > 0) {
          toastError(`${failed} email${failed !== 1 ? "s" : ""} failed. Check error logs.`);
        } else {
          toastSuccess(`No new emails to deliver. (${skipped} already up to date)`);
        }
      }
    } finally {
      setSending(false);
    }
  };

  /** Test email: send one branded test to the entered address */
  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) return toastError("Enter a test email address.");
    setTesting(true);
    setLastResult(null);
    try {
      const res = await apiPost<SendResult>("/api/cron/calibration-notifications", { testEmail: testEmail.trim() });
      if (res.error) {
        toastError(res.error.message);
      } else if (res.data) {
        setLastResult(res.data);
        if (res.data.ok) {
          toastSuccess(`✅ Test email sent to ${res.data.recipient}`);
        } else {
          toastError(`Test failed: ${res.data.error ?? "Unknown error"}`);
        }
      }
    } finally {
      setTesting(false);
    }
  };

  const readyCount = data?.primaryRecipients.filter((u) => u.eligible).length ?? 0;
  const totalCount = data?.primaryRecipients.length ?? 0;

  return (
    <div className="flex h-screen bg-[var(--bg-app)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Calibration Email Notifications</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Configure who receives calibration reminders and trigger manual sends.
              </p>
            </div>
            {/* ── Force Resend action ── */}
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Button
                onClick={forceResend}
                disabled={sending}
                className="flex items-center gap-2 bg-[var(--accent)] text-white"
              >
                {sending ? (
                  <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Sending…</>
                ) : (
                  <>📤 Resend Digest Now</>
                )}
              </Button>
              <p className="text-xs text-[var(--text-muted)]">
                Ignores &quot;already sent&quot; — delivers to all eligible users
              </p>
            </div>
          </div>

          {/* ── Result banner ── */}
          {lastResult && (
            <div className={`mb-5 rounded-xl border p-4 text-sm ${
              (lastResult.ok === false || (lastResult.failed ?? 0) > 0)
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}>
              {lastResult.ok !== undefined ? (
                /* test result */
                lastResult.ok
                  ? <>✅ Test email delivered to <strong>{lastResult.recipient}</strong> — Subject: <em>{lastResult.subject}</em></>
                  : <>❌ Test failed: {lastResult.error}</>
              ) : (
                /* digest result */
                <>
                  Digest run complete —{" "}
                  <strong>{lastResult.sent ?? 0} sent</strong>,{" "}
                  {lastResult.skipped ?? 0} skipped,{" "}
                  {(lastResult.failed ?? 0) > 0 && <><strong className="text-red-700">{lastResult.failed} failed</strong>,{" "}</>}
                  {lastResult.forced && <span className="font-medium">force mode was active.</span>}
                </>
              )}
            </div>
          )}

          {!data ? <p className="text-sm text-[var(--text-muted)]">Loading…</p> : (
            <div className="grid gap-5 xl:grid-cols-2">

              {/* ── Reminder Rules ── */}
              <section className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
                <h2 className="mb-4 font-semibold">Reminder Rules</h2>
                <div className="form-grid">
                  <div>
                    <label className="form-label">In-app visibility window (days)</label>
                    <input
                      type="number" min={1} max={365} className="form-control"
                      value={data.setting.alertDays}
                      onChange={(e) => setData({ ...data, setting: { ...data.setting, alertDays: Number(e.target.value) } })}
                    />
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={data.setting.systemEnabled}
                      onChange={(e) => setData({ ...data, setting: { ...data.setting, systemEnabled: e.target.checked } })} />
                    In-app notifications
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={data.setting.emailEnabled}
                      onChange={(e) => setData({ ...data, setting: { ...data.setting, emailEnabled: e.target.checked } })} />
                    Email outbox
                  </label>
                </div>
                <Button className="mt-4" onClick={saveSettings}>Save Rules</Button>
                <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                  Email schedule: 15 days, 7 days, due today, then daily while overdue. Use the Resend Digest button above after adding new users.
                </p>
              </section>

              {/* ── Test Email ── */}
              <section className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
                <h2 className="mb-2 font-semibold">Send Test Email</h2>
                <p className="mb-4 text-xs text-[var(--text-muted)]">
                  Sends one branded calibration reminder to your inbox to verify SMTP is working. Does not consume a real notification.
                </p>
                <form onSubmit={sendTest} className="flex gap-3">
                  <input
                    required type="email" className="form-control flex-1"
                    placeholder="yourname@company.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                  <Button type="submit" disabled={testing} variant="outline" className="shrink-0">
                    {testing ? "Sending…" : "Send Test"}
                  </Button>
                </form>
              </section>

              {/* ── Add Escalation CC ── */}
              <section className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
                <h2 className="mb-2 font-semibold">Add Escalation CC</h2>
                <p className="mb-4 text-xs text-[var(--text-muted)]">
                  These addresses are copied only on Quality Manager digests. They never replace role and unit routing.
                </p>
                <form onSubmit={addRecipient} className="form-grid">
                  <div>
                    <label className="form-label">Name *</label>
                    <input required className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Email *</label>
                    <input required type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Unit scope</label>
                    <select className="form-control" value={form.unitCode} onChange={(e) => setForm({ ...form, unitCode: e.target.value })}>
                      <option value="">All units</option>
                      <option value="UNIT1">Unit 1</option>
                      <option value="UNIT2">Unit 2</option>
                      <option value="UNIT3">Unit 3</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button type="submit">Add Escalation CC</Button>
                  </div>
                </form>
              </section>

              {/* ── Ready count summary ── */}
              <div className="flex items-center gap-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-2xl font-bold text-emerald-700">
                  {readyCount}
                </div>
                <div>
                  <p className="text-sm font-semibold">Ready to receive email</p>
                  <p className="text-xs text-[var(--text-muted)]">{readyCount} of {totalCount} configured users are fully eligible.</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Users need: active account + email address + role + Receive Alerts permission + unit scope.</p>
                </div>
              </div>

              {/* ── Primary Notification Users ── */}
              <section className="xl:col-span-2 overflow-hidden rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)]">
                <div className="border-b border-[var(--border-main)] px-4 py-3">
                  <h2 className="font-semibold">Primary Notification Users</h2>
                  <p className="text-xs text-[var(--text-muted)]">Managed from Settings → Users and Settings → Roles &amp; Permissions. Only rows marked <span className="font-medium text-emerald-700">Ready</span> receive email.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--bg-subtle)] text-left">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Unit Scope</th>
                        <th>Alert Permission</th>
                        <th>Delivery Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.primaryRecipients.map((user) => (
                        <tr className="border-t border-[var(--border-main)]" key={user.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-[var(--text-muted)]">{user.username}</div>
                          </td>
                          <td>
                            {user.email ? (
                              <span className="font-mono text-xs">{user.email}</span>
                            ) : (
                              <span className="text-amber-600 text-xs font-medium">Missing — add in Settings → Users</span>
                            )}
                          </td>
                          <td>{user.role || <span className="text-[var(--text-muted)]">Not assigned</span>}</td>
                          <td>{unitScopeLabel(user.unitScopes)}</td>
                          <td>{user.permissionEnabled ? "✅ Enabled" : "❌ Disabled"}</td>
                          <td>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                              user.eligible
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {user.reason}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!data.primaryRecipients.length && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-[var(--text-muted)]">No internal users configured.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ── Escalation CC ── */}
              <section className="xl:col-span-2 overflow-hidden rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)]">
                <div className="border-b border-[var(--border-main)] px-4 py-3">
                  <h2 className="font-semibold">Escalation CC</h2>
                  <p className="text-xs text-[var(--text-muted)]">Optional copies sent only with Quality Manager digests.</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-subtle)] text-left">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th>Email</th>
                      <th>Unit Scope</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recipients.map((r) => (
                      <tr className="border-t border-[var(--border-main)]" key={r.id}>
                        <td className="px-4 py-3">{r.name}</td>
                        <td className="font-mono text-xs">{r.email}</td>
                        <td>{r.unitCode?.replace(/^UNIT/, "Unit ") || "All Units"}</td>
                        <td>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {r.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <Button size="sm" variant="outline" onClick={() => toggle(r)}>
                            {r.isActive ? "Disable" : "Enable"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!data.recipients.length && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No escalation CC addresses configured.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
