/**
 * Attendance Manager Dashboard — team attendance overview for managers.
 * Shows attendance summary, flag distribution, team requests.
 */

'use client';

import { useState, useEffect } from 'react';

interface AttendanceStats {
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
  late: number;
  earlyOut: number;
  onDuty: number;
  wfh: number;
}

interface TeamMember {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
  status: string;
}

export default function AttendanceManagerDashboard() {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch team members
        const teamRes = await fetch('/api/workforce/my-team');
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          setTeamMembers(teamData.data ?? []);
        }

        // Mock stats for now
        setStats({
          present: 24,
          absent: 2,
          leave: 3,
          halfDay: 1,
          late: 2,
          earlyOut: 1,
          onDuty: 1,
          wfh: 6,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const statusColor: Record<string, { bg: string; fg: string }> = {
    Present: { bg: '#dcfce7', fg: '#166534' },
    Absent: { bg: '#fee2e2', fg: '#991b1b' },
    Leave: { bg: '#e0e7ff', fg: '#3730a3' },
    Late: { bg: '#fef3c7', fg: '#92400e' },
    'On Duty': { bg: '#dbeafe', fg: '#1e40af' },
    WFH: { bg: '#f3e8ff', fg: '#6b21a8' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Attendance Manager Dashboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Team attendance overview and request management
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--foreground-muted)' }}>Loading dashboard...</div>
      ) : (
        <>
          {/* Attendance Summary Cards */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                  Present
                </div>
                <div className="mt-2 text-2xl font-bold text-green-600">{stats.present}</div>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                  Absent
                </div>
                <div className="mt-2 text-2xl font-bold text-red-600">{stats.absent}</div>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                  Leave
                </div>
                <div className="mt-2 text-2xl font-bold text-blue-600">{stats.leave}</div>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                  WFH
                </div>
                <div className="mt-2 text-2xl font-bold text-purple-600">{stats.wfh}</div>
              </div>
            </div>
          )}

          {/* Attendance Flags */}
          <div className="rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              Attendance Flags
            </h2>
            {stats && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500">{stats.late}</div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    Late Arrivals
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{stats.earlyOut}</div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    Early Out
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">{stats.onDuty}</div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    On Duty
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-500">{stats.halfDay}</div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    Half Days
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Team Overview */}
          <div className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="border-b px-6 py-3" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                Team Members ({teamMembers.length})
              </h2>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3">Designation</th>
                    <th className="px-6 py-3">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-6 text-center" style={{ color: 'var(--foreground-muted)' }}>
                        No team members assigned
                      </td>
                    </tr>
                  ) : (
                    teamMembers.map((member) => (
                      <tr key={member.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-6 py-3">
                          <div className="font-medium">{member.firstName} {member.lastName}</div>
                          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                            {member.employeeCode}
                          </div>
                        </td>
                        <td className="px-6 py-3">{member.designation}</td>
                        <td className="px-6 py-3">{member.department}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4 hover:bg-opacity-50" style={{ borderColor: 'var(--border)', cursor: 'pointer' }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                📋 Pending Approvals
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-600">12</div>
              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Leave requests, OT, etc.
              </div>
            </div>
            <div className="rounded-lg border p-4 hover:bg-opacity-50" style={{ borderColor: 'var(--border)', cursor: 'pointer' }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                📊 Reports
              </div>
              <div className="mt-2 text-2xl font-bold text-green-600">5</div>
              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Monthly attendance reports
              </div>
            </div>
            <div className="rounded-lg border p-4 hover:bg-opacity-50" style={{ borderColor: 'var(--border)', cursor: 'pointer' }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                ⚠️ Issues
              </div>
              <div className="mt-2 text-2xl font-bold text-orange-600">3</div>
              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Attendance discrepancies
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
