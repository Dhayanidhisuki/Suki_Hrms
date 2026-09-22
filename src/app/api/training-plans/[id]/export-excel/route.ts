/**
 * GET /api/training-plans/[id]/export-excel — annual training calendar in the
 * reference Excel layout:
 *
 *   KUN AEROSPACE PVT LTD                     (merged title row)
 *   ANNUAL PLAN TRAINING - (2025 - 2026)      (merged subtitle row)
 *   SL NO | TOPIC | TRAINER | TRAINEES | TYPE | Apr-25 | May-25 | … | Mar-26
 *
 * Month columns follow the fiscal year (April → March). A line's planned month
 * is shown as "Nov-26"; "Postponed to <Mon YYYY>" or remarks appear in the
 * cell exactly like the reference sheet. A Planned/Completed/Post Poned legend
 * sits below the grid.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtMonYear(d: Date) {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { id } = await params;
  const plan = await prisma.trainingPlan.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
    include: {
      lines: {
        where: { deletedAt: null, isActive: true },
        orderBy: { plannedMonth: 'asc' },
        include: { trainingProgram: { select: { name: true } } },
      },
    },
  });
  if (!plan) return NextResponse.json({ error: 'Training plan not found' }, { status: 404 });

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });

  // Trainer + internal-mentor names are scalar FKs — resolve them in one pass.
  const trainerIds = [...new Set(plan.lines.map((l) => l.trainerId).filter((v): v is number => v != null))];
  const mentorIds = [...new Set(plan.lines.map((l) => l.mentorEmployeeId).filter((v): v is number => v != null))];
  const [trainers, mentors] = await Promise.all([
    trainerIds.length ? prisma.trainer.findMany({ where: { id: { in: trainerIds }, companyId } }) : [],
    mentorIds.length ? prisma.employee.findMany({ where: { id: { in: mentorIds }, companyId } }) : [],
  ]);
  const trainerById = new Map(trainers.map((t) => [t.id, t]));
  const mentorById = new Map(mentors.map((m) => [m.id, m]));

  // Fiscal year: plan.year like "2025" or "2025-26" → April of the first year.
  const startYear = parseInt(String(plan.year).slice(0, 4)) || new Date().getFullYear();
  // Calendar month (1-12) → fiscal column index (Apr=0 … Mar=11).
  const monthCol = (m: number) => (m + 8) % 12;
  // Calendar month → the year it falls in for this fiscal plan.
  const monthYear = (m: number) => (m >= 4 ? startYear : startYear + 1);
  // Header labels: Apr-25 … Mar-26.
  const monthHeaders = Array.from({ length: 12 }, (_, i) => {
    const calMonth = ((i + 4 - 1) % 12) + 1; // fiscal col i → calendar month
    const calYear = i <= 8 ? startYear : startYear + 1;
    return `${MONTHS_SHORT[calMonth - 1]}-${String(calYear).slice(2)}`;
  });
  // "Nov-26" style marker for a planned month.
  const monthMarker = (m: number) => `${MONTHS_SHORT[m - 1]}-${String(monthYear(m)).slice(2)}`;

  const header = ['SL NO', 'TOPIC', 'TRAINER', 'TRAINEES', 'TYPE', ...monthHeaders];
  const aoa: (string | number)[][] = [
    [company?.name?.toUpperCase() ?? ''],
    [`ANNUAL PLAN TRAINING - (${startYear} - ${startYear + 1})`],
    header,
  ];

  plan.lines.forEach((line, idx) => {
    const trainer = line.trainerId ? trainerById.get(line.trainerId) : null;
    const trainerLabel = trainer
      ? `${trainer.name.toUpperCase()} (${trainer.isExternal ? 'EXTERNAL' : 'INTERNAL'})`
      : '';
    const mentorLabel =
      line.mentorType === 'EXTERNAL'
        ? (line.externalMentorName ?? '')
        : line.mentorEmployeeId
          ? (() => { const m = mentorById.get(line.mentorEmployeeId!); return m ? `${m.firstName} ${m.lastName}`.trim() : ''; })()
          : '';
    const trainees = [line.targetDepartments, line.traineeCategory]
      .filter(Boolean)
      .join('\n');

    const cells: (string | number)[] = [
      String(idx + 1),
      (line.trainingProgram?.name ?? '').toUpperCase(),
      [trainerLabel, mentorLabel ? `Mentor: ${mentorLabel}` : ''].filter(Boolean).join('\n'),
      trainees,
      line.trainerType ?? '',
      ...Array(12).fill(''),
    ];

    const col = 5 + monthCol(line.plannedMonth);
    if (line.postponedTo) {
      cells[col] = `Postponed to ${fmtMonYear(new Date(line.postponedTo))}`;
    } else if (line.remarks) {
      cells[col] = line.remarks;
    } else {
      cells[col] = monthMarker(line.plannedMonth);
    }
    // Month-wise window: mark the other months in the from→to range.
    if (line.schedulePeriod === 'MONTH_WISE' && line.monthFrom != null && line.monthTo != null) {
      for (let m = line.monthFrom; m <= line.monthTo; m++) {
        if (m !== line.plannedMonth) cells[5 + monthCol(m)] = monthMarker(m);
      }
    }
    aoa.push(cells);
  });

  // Legend block, same position as the reference sheet (column C below the grid).
  aoa.push(Array(17).fill(''));
  aoa.push(['', '', 'Planned', ...Array(14).fill('')]);
  aoa.push(['', '', 'Completed', ...Array(14).fill('')]);
  aoa.push(['', '', 'Post Poned', ...Array(14).fill('')]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } },
  ];
  ws['!cols'] = [
    { wch: 7 },
    { wch: 36 },
    { wch: 27 },
    { wch: 20 },
    { wch: 20 },
    ...monthHeaders.map(() => ({ wch: 14 })),
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Annual Plan');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  const filename = `Annual-Training-Calendar-${startYear}-${startYear + 1}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
