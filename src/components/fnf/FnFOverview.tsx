'use client';

import { StatusBadge } from '@/components/ui';
import { FNF_STATUS_TONE } from '@/lib/fnf/workflow';
import FnFKunStatement from '@/components/fnf/FnFKunStatement';
import type { KunFnfStatement } from '@/lib/fnf/kun-statement';
import { type FnFDisplayLine } from '@/lib/fnf/presentation';

export type FnFOverviewSettlement = {
  id?: number;
  status: string;
  lastWorkingDay: string;
  payableDays: string | number;
  salaryDivisor?: number;
  noticeServedDays?: number;
  noticeWaivedDays?: number;
  noticeShortfallDays?: number;
  freezeSnapshotId?: number | null;
  snapshotJson?: string | null;
  leaveEncashment?: string | number;
  leaveEncashmentDays?: number;
  gratuity?: string | number;
  bonusProportion?: string | number;
  incentiveAmount?: string | number;
  totalPayable?: string | number;
  totalRecovery?: string | number;
  netPayable?: string | number;
  paymentDate?: string | null;
  paymentReference?: string | null;
  kunStatement?: KunFnfStatement | null;
  employee: {
    oldEmployeeCode: string | null;
    firstName: string;
    lastName: string;
    bankDetail?: { accountNumber?: string | null; bankName?: string | null; ifscCode?: string | null } | null;
    jobInfos?: {
      joinDate: string;
      paymentMode?: string | null;
      esiApplicable?: boolean;
      department?: { name: string } | null;
      designation?: { name: string } | null;
    }[];
  };
  exitInterview: {
    exitType: string;
    clearanceStatus?: string;
    clearanceChecks?: { checkCode: string; status: string }[];
  };
  lines: FnFDisplayLine[];
};

export default function FnFOverview({
  settlement,
  lines,
  canEdit,
  readOnly,
  served,
  waived,
  onServedChange,
  onWaivedChange,
  onLineAmountChange,
}: {
  settlement: FnFOverviewSettlement;
  lines: FnFDisplayLine[];
  canEdit?: boolean;
  readOnly?: boolean;
  served?: string;
  waived?: string;
  onServedChange?: (v: string) => void;
  onWaivedChange?: (v: string) => void;
  onLineAmountChange?: (index: number, amount: string) => void;
  maskAccount?: boolean;
}) {
  const editable = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.editable);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">
          {settlement.employee.oldEmployeeCode ? `${settlement.employee.oldEmployeeCode} — ` : ''}{settlement.employee.firstName} {settlement.employee.lastName}
        </h2>
        <StatusBadge tone={FNF_STATUS_TONE[settlement.status] ?? 'neutral'}>{settlement.status}</StatusBadge>
        {(settlement.paymentDate || settlement.paymentReference) && (
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Paid {settlement.paymentDate ? String(settlement.paymentDate).slice(0, 10) : ''}
            {settlement.paymentReference ? ` · ${settlement.paymentReference}` : ''}
          </span>
        )}
      </div>
      {settlement.exitInterview.clearanceChecks && settlement.exitInterview.clearanceChecks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {settlement.exitInterview.clearanceChecks.map((c) => (
            <span
              key={c.checkCode}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
              style={{
                backgroundColor: c.status === 'CLEARED' ? '#dcfce7' : '#fef9c3',
                color: c.status === 'CLEARED' ? '#166534' : '#854d0e',
              }}
            >
              {c.checkCode}: {c.status}
            </span>
          ))}
        </div>
      )}
      {!readOnly && canEdit && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Notice served (days)
            <input
              className="rounded-lg border px-3 py-2"
              value={served ?? ''}
              onChange={(e) => onServedChange?.(e.target.value)}
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            />
          </label>
          <label className="flex flex-col gap-1">
            Notice waived (days)
            <input
              className="rounded-lg border px-3 py-2"
              value={waived ?? ''}
              onChange={(e) => onWaivedChange?.(e.target.value)}
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            />
          </label>
        </div>
      )}

      {settlement.kunStatement ? (
        <div className="overflow-x-auto rounded-sm bg-zinc-200 p-3">
          <FnFKunStatement statement={settlement.kunStatement} />
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Open this settlement to load the KUN statement.
        </p>
      )}

      {!readOnly && canEdit && editable.length > 0 && (
        <div className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-2 text-xs font-semibold">Editable lines</p>
          {editable.map(({ l, i }) => (
            <div key={`${l.code}-${i}`} className="mb-1 grid grid-cols-[1fr_8rem] items-center gap-2">
              <span>{l.name}</span>
              <input
                className="rounded-md border px-2 py-1 text-right"
                value={String(l.amount)}
                onChange={(e) => onLineAmountChange?.(i, e.target.value)}
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
