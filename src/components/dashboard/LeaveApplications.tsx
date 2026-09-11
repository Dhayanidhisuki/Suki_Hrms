'use client';

import { useEffect, useState } from 'react';
import { Avatar, Badge, GhostButton, PanelHeader } from "./Primitives";

interface LeaveApp {
  id: string;
  employeeId: number;
  employee?: { firstName: string; lastName: string };
  leaveType?: { name: string };
  status: string;
}

export default function LeaveApplications() {
  const [applications, setApplications] = useState<LeaveApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        const res = await fetch('/api/leaves?limit=5&status=PENDING,APPROVED');
        if (res.ok) {
          const data = await res.json();
          setApplications(data.data?.slice(0, 5) || []);
        }
      } catch (error) {
        console.error('Error fetching leaves:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaves();
  }, []);

  const getName = (app: LeaveApp) => {
    if (app.employee) {
      return `${app.employee.firstName} ${app.employee.lastName}`;
    }
    return 'Unknown Employee';
  };

  if (loading) {
    return (
      <section className="card flex flex-col">
        <PanelHeader title="Leave Application" action={<GhostButton>See Details</GhostButton>} />
        <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-5 pb-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-700" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="card flex flex-col">
      <PanelHeader title="Leave Application" action={<GhostButton>See Details</GhostButton>} />
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-5 pb-5">
        {applications.length > 0 ? (
          applications.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="flex items-center gap-3 rounded-2xl border p-3"
              style={{ borderColor: "var(--border)" }}
            >
              <Avatar name={getName(item)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {getName(item)}
                </p>
                <p className="truncate text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                  {item.leaveType?.name || 'Leave'} - {item.status}
                </p>
              </div>
              <Badge tone={item.status === "APPROVED" ? "success" : "warning"}>{item.status}</Badge>
            </div>
          ))
        ) : (
          <p style={{ color: "var(--foreground-muted)" }} className="text-center py-4">
            No leave applications
          </p>
        )}
      </div>
    </section>
  );
}
