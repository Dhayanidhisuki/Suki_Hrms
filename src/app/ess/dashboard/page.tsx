'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardData {
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  company: string;
  joinDate: string;
  status: string;
}

interface AttendanceData {
  date: string;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
}

interface LeaveBalance {
  type: string;
  available: number;
  used: number;
}

export default function EssDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [profileRes, attendanceRes, leaveRes] = await Promise.all([
          fetch('/api/workforce/my-profile'),
          fetch('/api/workforce/my-attendance?year=' + new Date().getFullYear() + '&month=' + (new Date().getMonth() + 1)),
          fetch('/api/workforce/my-leave?year=' + new Date().getFullYear()),
        ]);

        if (profileRes.ok) {
          const json = await profileRes.json();
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

        if (attendanceRes.ok) {
          const json = await attendanceRes.json();
          const days = json.data ?? [];
          const chartData = days.slice(-7).map((d: any) => ({
            date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
            present: d.status === 'Present' ? 1 : 0,
            absent: d.status === 'Absent' ? 1 : 0,
            late: d.lateMinutes > 0 ? 1 : 0,
            halfDay: d.status === 'HalfDay' ? 1 : 0,
          }));
          setAttendanceData(chartData);
        }

        if (leaveRes.ok) {
          const json = await leaveRes.json();
          const balances = json.balances ?? [];
          const leaveData = balances.slice(0, 3).map((b: any) => ({
            type: b.leaveMaster.name,
            available: Math.max(0, Number(b.closingBalance) - Number(b.availed)),
            used: Number(b.availed),
          }));
          setLeaveBalance(leaveData);
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

      {/* Attendance Chart */}
      {attendanceData.length > 0 && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Recent Attendance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--foreground-muted)" />
              <YAxis stroke="var(--foreground-muted)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }} />
              <Legend />
              <Bar dataKey="present" fill="#16a34a" name="Present" />
              <Bar dataKey="absent" fill="#dc2626" name="Absent" />
              <Bar dataKey="late" fill="#f59e0b" name="Late" />
              <Bar dataKey="halfDay" fill="#eab308" name="Half Day" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leave Balance Chart */}
      {leaveBalance.length > 0 && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Leave Balance Overview</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {leaveBalance.map((leave) => {
              const total = leave.available + leave.used;
              const percentage = total > 0 ? (leave.available / total) * 100 : 0;
              return (
                <div key={leave.type} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>{leave.type}</div>
                  <div className="mt-3 flex items-end gap-4">
                    <div>
                      <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{leave.available}</div>
                      <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Available</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--border)' }}>
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%`, backgroundColor: '#3b82f6' }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-center" style={{ color: 'var(--foreground-muted)' }}>
                        {leave.used} used
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
