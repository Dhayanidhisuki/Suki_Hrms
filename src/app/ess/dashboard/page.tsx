'use client';

import { useState, useEffect } from 'react';

interface DashboardData {
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  company: string;
  joinDate: string;
  status: string;
}

export default function EssDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/workforce/my-profile');
        if (res.ok) {
          const json = await res.json();
          setData({
            employeeName: [json.firstName, json.middleName, json.lastName].filter(Boolean).join(' '),
            employeeCode: json.employeeCode,
            designation: json.designation ?? 'N/A',
            department: json.department ?? 'N/A',
            company: json.companyName ?? 'N/A',
            joinDate: json.joinDate ? new Date(json.joinDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) : 'N/A',
            status: json.status ?? 'N/A',
          });
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const quickLinks = [
    { label: 'My Attendance', href: '/ess/attendance', icon: '📊' },
    { label: 'Leave Requests', href: '/ess/leave', icon: '📝' },
    { label: 'My Payslip', href: '/ess/payslip', icon: '💰' },
    { label: 'My Profile', href: '/ess/profile', icon: '👤' },
    { label: 'Documents', href: '/ess/documents', icon: '📄' },
    { label: 'Permissions', href: '/ess/permission', icon: '✅' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="rounded-lg p-6" style={{ background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface) 100%)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
              Welcome back, {data?.employeeName || 'Employee'}!
            </h1>
            <p className="mt-1 text-sm uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
              {data?.designation} {data?.department ? '• ' + data.department : ''}
            </p>
          </div>
          <div className="text-5xl">👋</div>
        </div>
      </div>

      {/* Employee Info Cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="text-xs uppercase font-medium" style={{ color: 'var(--foreground-muted)' }}>
              Employee Code
            </div>
            <div className="mt-2 text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              {data.employeeCode}
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="text-xs uppercase font-medium" style={{ color: 'var(--foreground-muted)' }}>
              Company
            </div>
            <div className="mt-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {data.company}
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="text-xs uppercase font-medium" style={{ color: 'var(--foreground-muted)' }}>
              Join Date
            </div>
            <div className="mt-2 text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              {data.joinDate}
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="text-xs uppercase font-medium" style={{ color: 'var(--foreground-muted)' }}>
              Status
            </div>
            <div className="mt-2 text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              {data.status}
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          Quick Access
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex flex-col items-center justify-center rounded-lg border p-4 text-center transition hover:border-blue-400"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--surface)',
              }}
            >
              <div className="text-2xl">{link.icon}</div>
              <div className="mt-2 text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                {link.label}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Help Section */}
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
        <div className="flex items-start gap-3">
          <div className="text-xl">ℹ️</div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Need Help?
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
              Navigate using the menu on the left to access your attendance records, leave requests, payslips, and profile information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
