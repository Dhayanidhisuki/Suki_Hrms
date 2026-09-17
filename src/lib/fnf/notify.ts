import { emitPlatformEvent } from '@/lib/platform/events';
import { prisma } from '@/lib/prisma';

const EVENTS: { code: string; name: string; recipients: string }[] = [
  { code: 'FNF_SUBMITTED', name: 'F&F submitted for approval', recipients: 'ROLE:hr-admin,SUBJECT_MANAGER_L1' },
  { code: 'FNF_MANAGER_APPROVED', name: 'F&F manager approved', recipients: 'ROLE:hr-admin' },
  { code: 'FNF_APPROVED', name: 'F&F HR approved', recipients: 'SUBJECT_EMPLOYEE,ROLE:hr-admin' },
  { code: 'FNF_FINANCE_VERIFIED', name: 'F&F finance verified', recipients: 'SUBJECT_EMPLOYEE,ROLE:hr-admin' },
  { code: 'FNF_REJECTED', name: 'F&F rejected', recipients: 'SUBJECT_EMPLOYEE,ROLE:hr-admin' },
  { code: 'FNF_PAID', name: 'F&F marked paid', recipients: 'SUBJECT_EMPLOYEE' },
  { code: 'FNF_COMPLETED', name: 'F&F completed', recipients: 'SUBJECT_EMPLOYEE' },
  { code: 'FNF_CANCELLED', name: 'F&F cancelled', recipients: 'ROLE:hr-admin' },
];

async function ensureFnfNotificationCatalog(companyId: number) {
  for (const ev of EVENTS) {
    await prisma.notificationEvent.upsert({
      where: { companyId_code: { companyId, code: ev.code } },
      create: {
        companyId,
        code: ev.code,
        name: ev.name,
        moduleCode: 'FNFS',
        category: 'TRANSACTIONAL',
        defaultRecipients: ev.recipients,
        inAppEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        pushEnabled: false,
        isActive: true,
      },
      update: { isActive: true, inAppEnabled: true },
    });
    const existing = await prisma.notificationTemplate.findFirst({
      where: { companyId, eventCode: ev.code, channel: 'INAPP', status: 'Active' },
    });
    if (!existing) {
      await prisma.notificationTemplate.create({
        data: {
          companyId,
          code: `${ev.code}_INAPP`,
          name: ev.name,
          eventCode: ev.code,
          channel: 'INAPP',
          language: 'en-IN',
          effectiveFrom: new Date('2020-01-01'),
          subject: ev.name,
          bodyText: '{{FnF.EmployeeName}} — net ₹{{FnF.NetPayable}}. Status {{FnF.Status}}.',
          status: 'Active',
        },
      });
    }
  }
}

export async function emitFnfEvent(
  companyId: number,
  code: string,
  settlement: { id: number; employeeId: number; status: string; netPayable?: unknown; employee?: { firstName?: string; lastName?: string; employeeCode?: string } },
  extra?: { linkPath?: string },
) {
  try {
    await ensureFnfNotificationCatalog(companyId);
    const name = `${settlement.employee?.firstName ?? ''} ${settlement.employee?.lastName ?? ''}`.trim();
    await emitPlatformEvent(companyId, code, {
      moduleCode: 'FNFS',
      sourceEntityType: 'FnFSettlement',
      sourceEntityId: settlement.id,
      subjectEmpId: settlement.employeeId,
      linkPath: extra?.linkPath ?? '/payroll/processing/full-and-final',
      data: {
        FnF: {
          Id: settlement.id,
          Status: settlement.status,
          NetPayable: Number(settlement.netPayable ?? 0),
          EmployeeName: name,
          EmployeeCode: settlement.employee?.employeeCode ?? '',
        },
      },
    });
  } catch (err) {
    console.error('[fnf] notify failed', code, err);
  }
}
