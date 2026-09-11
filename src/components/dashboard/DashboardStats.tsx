'use client';

import { useEffect, useState } from 'react';
import StatCard from './StatCard';
import type { Tone } from './data';
import type { IconName } from '@/components/layout/NavIcons';

interface DashboardStatData {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down';
  tone: Tone;
  icon: IconName;
  visual: 'spark' | 'bars' | 'ticks' | 'meter';
  description: string;
}

export default function DashboardStats() {
  const [stats, setStats] = useState<DashboardStatData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch real data from API endpoints
        const [empRes, attRes] = await Promise.all([
          fetch('/api/stats/employees'),
          fetch('/api/stats/attendance'),
        ]);

        if (!empRes.ok || !attRes.ok) throw new Error('Stats API unavailable');
        const employees = await empRes.json();
        const attendance = await attRes.json();

        // Calculate stats from real data
        const totalEmployees = employees.total || 0;
        const activeEmployees = employees.active || 0;
        const inactiveEmployees = employees.inactive || 0;

        const statsData: DashboardStatData[] = [
          {
            label: 'Total Employee',
            value: String(totalEmployees).padStart(2, '0'),
            delta: '100%',
            trend: 'up',
            tone: 'success',
            icon: 'employee',
            visual: 'spark',
            description: `${totalEmployees} total employees in the system (${activeEmployees} active)`,
          },
          {
            label: 'Active Employees',
            value: String(activeEmployees).padStart(2, '0'),
            delta: `${activeEmployees > 0 ? Math.round((activeEmployees / totalEmployees) * 100) : 0}%`,
            trend: 'up',
            tone: 'success',
            icon: 'attendance',
            visual: 'bars',
            description: `${activeEmployees} active employees in the system`,
          },
          {
            label: 'Inactive Employees',
            value: String(inactiveEmployees).padStart(2, '0'),
            delta: `${inactiveEmployees > 0 ? Math.round((inactiveEmployees / totalEmployees) * 100) : 0}%`,
            trend: inactiveEmployees > 0 ? 'up' : 'down',
            tone: 'warning',
            icon: 'employee',
            visual: 'ticks',
            description: `${inactiveEmployees} inactive employees`,
          },
          {
            label: 'Attendance Rate',
            value: attendance.total > 0 ? String(Math.round((attendance.active / attendance.total) * 100)).padStart(2, '0') : '00',
            delta: `${attendance.total > 0 ? Math.round((attendance.active / attendance.total) * 100) : 0}%`,
            trend: 'up',
            tone: 'info',
            icon: 'leave',
            visual: 'meter',
            description: `${attendance.active || 0} present out of ${attendance.total || 0} attendance records`,
          },
        ];

        setStats(statsData);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        // Fallback to empty state
        setStats([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
