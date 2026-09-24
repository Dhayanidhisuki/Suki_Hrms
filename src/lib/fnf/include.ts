export const fnfInclude = {
  employee: {
    select: {
      id: true,
      oldEmployeeCode: true,
      firstName: true,
      lastName: true,
      bankDetail: { select: { accountNumber: true, bankName: true, ifscCode: true } },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          joinDate: true,
          paymentMode: true,
          esiApplicable: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
    },
  },
  exitInterview: {
    select: {
      id: true,
      exitDate: true,
      exitType: true,
      exitReason: true,
      resignationDate: true,
      noticePeriodDays: true,
      noticeServedDays: true,
      noticeWaivedDays: true,
      clearanceStatus: true,
      approvedLastWorkingDay: true,
      rehireEligible: true,
      clearanceChecks: true,
    },
  },
  lines: { orderBy: { sortOrder: 'asc' as const } },
  company: { select: { name: true, code: true, description: true } },
};
