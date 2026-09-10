/**
 * Manager Dashboard — team overview for the logged-in manager.
 * Shows KPIs, today's attendance breakdown, pending approvals, and
 * a team list with today's status.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { KPIGrid, KPICard } from '@/components/ui';
import Link from 'next/link';

interface DashboardData {
  teamSize: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  missingPunchToday: number;
  pendingApprovals: {
    mispunch: number;
    ot: number;
    leave: number;
    permission: number;
    salaryRevision: number;
  };
  teamList: Array<{
    id: number;
    employeeCode: string;
    firstName: string;
    lastName: string;
    statusToday: string;
  }>;
}

const statusColors: Record<string, string> = {
  Present: '#16a34a',
  OnDuty: '#16a34a',
  Absent: '#dc2626',
  Leave: '#2563eb',
  MissingPunch: '#d97706',
  LOP: '#dc2626',
  'Not Marked': '#9ca3af',
};

export default function ManagerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/manager/dashboard');
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) return <div style={{ padding: 24 }}>Loading manager dashboard…</div>;
  if (!data) return <div style={{ padding: 24 }}>Failed to load. Are you linked to an employee record?</div>;

  const totalPending =
    data.pendingApprovals.mispunch +
    data.pendingApprovals.ot +
    data.pendingApprovals.leave +
    data.pendingApprovals.permission +
    data.pendingApprovals.salaryRevision;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Manager Dashboard — My Team</h1>

      <KPIGrid>
        <KPICard label="Team Size" value={data.teamSize} tone="info" />
        <KPICard label="Present Today" value={data.presentToday} tone="success" />
        <KPICard label="Absent Today" value={data.absentToday} tone="danger" />
        <KPICard label="On Leave Today" value={data.onLeaveToday} tone="info" />
        <KPICard label="Missing Punch" value={data.missingPunchToday} tone="warning" />
        <KPICard label="Pending Approvals" value={totalPending} tone="warning" />
      </KPIGrid>

      {/* Pending Approvals Section */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>Pending Approvals</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ApprovalLink href="/approvals/workforce/mispunch" label="Mispunch" count={data.pendingApprovals.mispunch} />
        <ApprovalLink href="/approvals/workforce/overtime" label="Overtime" count={data.pendingApprovals.ot} />
        <ApprovalLink href="/approvals/workforce/leave" label="Leave" count={data.pendingApprovals.leave} />
        <ApprovalLink href="/ess/permission" label="Permission" count={data.pendingApprovals.permission} />
        <ApprovalLink href="/payroll/processing/revision" label="Salary Revision" count={data.pendingApprovals.salaryRevision} />
      </div>

      {/* Team List */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>
        Team — Today's Status
      </h2>
      {data.teamList.length === 0 ? (
        <div style={{ color: '#888', padding: 16 }}>No team members found.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Code</th>
              <th style={{ padding: '8px 12px' }}>Name</th>
              <th style={{ padding: '8px 12px' }}>Status Today</th>
            </tr>
          </thead>
          <tbody>
            {data.teamList.map((emp) => (
              <tr key={emp.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px 12px' }}>{emp.employeeCode}</td>
                <td style={{ padding: '8px 12px' }}>
                  {emp.firstName} {emp.lastName}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span
                    style={{
                      color: statusColors[emp.statusToday] ?? '#666',
                      fontWeight: 500,
                    }}
                  >
                    {emp.statusToday}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ApprovalLink({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 20px',
        border: '1px solid #ddd',
        borderRadius: 6,
        textDecoration: 'none',
        color: count > 0 ? '#d97706' : '#666',
        background: count > 0 ? '#fffbeb' : '#fff',
        minWidth: 120,
      }}
    >
      <span style={{ fontSize: 24, fontWeight: 700 }}>{count}</span>
      <span style={{ fontSize: 12 }}>{label}</span>
    </Link>
  );
}
