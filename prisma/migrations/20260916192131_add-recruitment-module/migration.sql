BEGIN TRY

BEGIN TRAN;

-- DropIndex
DROP INDEX [IX_FnFSettlement_companyId_status] ON [dbo].[FnFSettlement];

-- DropIndex
DROP INDEX [PlatformDocumentType_companyId_businessCategory_idx] ON [dbo].[PlatformDocumentType];

-- AlterTable
ALTER TABLE [dbo].[ExitInterview] ALTER COLUMN [exitType] NVARCHAR(20) NOT NULL;
ALTER TABLE [dbo].[ExitInterview] DROP COLUMN [approvedLastWorkingDay],
[clearanceStatus],
[noticePeriodDays],
[noticeServedDays],
[noticeWaivedDays],
[rehireEligible],
[resignationDate];

-- AlterTable
ALTER TABLE [dbo].[FnFSettlement] ALTER COLUMN [status] NVARCHAR(20) NOT NULL;
ALTER TABLE [dbo].[FnFSettlement] DROP COLUMN [arrearsAmount],
[clearanceOverrideRemark],
[completedAt],
[esiDeduction],
[financeVerifiedAt],
[financeVerifiedByUserId],
[freezeSnapshotId],
[holdReason],
[incentiveAmount],
[journalJson],
[noticeServedDays],
[noticeShortfallDays],
[noticeWaivedDays],
[overrideRemark],
[payableDays],
[pfDeduction],
[salaryDivisor],
[snapshotJson],
[submittedAt],
[submittedByUserId],
[tdsDeduction];

-- AlterTable
ALTER TABLE [dbo].[FullAndFinalConfig] DROP COLUMN [clearanceRequired],
[includeEsi],
[includePf],
[includePt],
[includeTds],
[noticeRateBasis],
[salaryDivisor],
[salaryDivisorMode];

-- AlterTable
ALTER TABLE [dbo].[JobPosting] DROP CONSTRAINT [DF__JobPostin__vacan__45B43A08];
ALTER TABLE [dbo].[JobPosting] ADD CONSTRAINT [JobPosting_vacancies_df] DEFAULT 1 FOR [vacancies];

-- AlterTable
ALTER TABLE [dbo].[LeaveApplication] DROP CONSTRAINT [LeaveApplication_status_df];
ALTER TABLE [dbo].[LeaveApplication] ADD CONSTRAINT [LeaveApplication_status_df] DEFAULT 'pending_manager' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[LeaveEncashmentConfig] DROP CONSTRAINT [DF_LeaveEncashmentConfig_calculationBasis],
[DF_LeaveEncashmentConfig_denominator],
[DF_LeaveEncashmentConfig_includeEarnedOnly],
[DF_LeaveEncashmentConfig_isActive],
[DF_LeaveEncashmentConfig_maxEncashableDays],
[DF_LeaveEncashmentConfig_minServiceMonths],
[DF_LeaveEncashmentConfig_prorateByLop];
EXEC SP_RENAME N'dbo.PK_LeaveEncashmentConfig', N'LeaveEncashmentConfig_pkey';
ALTER TABLE [dbo].[LeaveEncashmentConfig] ADD CONSTRAINT [LeaveEncashmentConfig_calculationBasis_df] DEFAULT 'GROSS' FOR [calculationBasis], CONSTRAINT [LeaveEncashmentConfig_denominator_df] DEFAULT 26 FOR [denominator], CONSTRAINT [LeaveEncashmentConfig_includeEarnedOnly_df] DEFAULT 1 FOR [includeEarnedOnly], CONSTRAINT [LeaveEncashmentConfig_isActive_df] DEFAULT 1 FOR [isActive], CONSTRAINT [LeaveEncashmentConfig_maxEncashableDays_df] DEFAULT 45 FOR [maxEncashableDays], CONSTRAINT [LeaveEncashmentConfig_minServiceMonths_df] DEFAULT 0 FOR [minServiceMonths], CONSTRAINT [LeaveEncashmentConfig_prorateByLop_df] DEFAULT 0 FOR [prorateByLop];

-- AlterTable
ALTER TABLE [dbo].[LeaveMaster] DROP CONSTRAINT [DF_LeaveMaster_probationEligible];
ALTER TABLE [dbo].[LeaveMaster] ADD CONSTRAINT [LeaveMaster_probationEligible_df] DEFAULT 1 FOR [probationEligible];

-- AlterTable
ALTER TABLE [dbo].[LeaveTypeMaster] DROP CONSTRAINT [DF__LeaveType__creat__69478F08],
[DF__LeaveType__isAct__68536ACF];
EXEC SP_RENAME N'dbo.PK_LeaveTypeMaster', N'LeaveTypeMaster_pkey';
ALTER TABLE [dbo].[LeaveTypeMaster] ADD CONSTRAINT [LeaveTypeMaster_createdAt_df] DEFAULT CURRENT_TIMESTAMP FOR [createdAt], CONSTRAINT [LeaveTypeMaster_isActive_df] DEFAULT 1 FOR [isActive];

-- AlterTable
ALTER TABLE [dbo].[LicDeductionConfig] DROP CONSTRAINT [DF_LicDeductionConfig_amount],
[DF_LicDeductionConfig_deductionType],
[DF_LicDeductionConfig_isActive],
[DF_LicDeductionConfig_minAmount];
EXEC SP_RENAME N'dbo.PK_LicDeductionConfig', N'LicDeductionConfig_pkey';
ALTER TABLE [dbo].[LicDeductionConfig] ADD CONSTRAINT [LicDeductionConfig_amount_df] DEFAULT 0 FOR [amount], CONSTRAINT [LicDeductionConfig_deductionType_df] DEFAULT 'FLAT' FOR [deductionType], CONSTRAINT [LicDeductionConfig_isActive_df] DEFAULT 1 FOR [isActive], CONSTRAINT [LicDeductionConfig_minAmount_df] DEFAULT 0 FOR [minAmount];

-- AlterTable
ALTER TABLE [dbo].[Loan] DROP CONSTRAINT [DF_Loan_installmentsPaid],
[DF_Loan_interestPaid],
[DF_Loan_interestRate],
[DF_Loan_principalPaid],
[DF_Loan_status];
EXEC SP_RENAME N'dbo.PK_Loan', N'Loan_pkey';
ALTER TABLE [dbo].[Loan] ADD CONSTRAINT [Loan_installmentsPaid_df] DEFAULT 0 FOR [installmentsPaid], CONSTRAINT [Loan_interestPaid_df] DEFAULT 0 FOR [interestPaid], CONSTRAINT [Loan_interestRate_df] DEFAULT 0 FOR [interestRate], CONSTRAINT [Loan_principalPaid_df] DEFAULT 0 FOR [principalPaid], CONSTRAINT [Loan_status_df] DEFAULT 'pending' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[LoanInstallment] DROP CONSTRAINT [DF_LoanInstallment_status];
EXEC SP_RENAME N'dbo.PK_LoanInstallment', N'LoanInstallment_pkey';
ALTER TABLE [dbo].[LoanInstallment] ADD CONSTRAINT [LoanInstallment_status_df] DEFAULT 'pending' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[LomConfig] DROP CONSTRAINT [DF_LomConfig_calculationBasis],
[DF_LomConfig_graceMinutesExempt],
[DF_LomConfig_isActive],
[DF_LomConfig_multiplier],
[DF_LomConfig_payrollDaysDenominator],
[DF_LomConfig_shiftDurationSource];
EXEC SP_RENAME N'dbo.PK_LomConfig', N'LomConfig_pkey';
ALTER TABLE [dbo].[LomConfig] ADD CONSTRAINT [LomConfig_calculationBasis_df] DEFAULT 'GROSS' FOR [calculationBasis], CONSTRAINT [LomConfig_graceMinutesExempt_df] DEFAULT 0 FOR [graceMinutesExempt], CONSTRAINT [LomConfig_isActive_df] DEFAULT 1 FOR [isActive], CONSTRAINT [LomConfig_multiplier_df] DEFAULT 1 FOR [multiplier], CONSTRAINT [LomConfig_payrollDaysDenominator_df] DEFAULT 'CALENDAR' FOR [payrollDaysDenominator], CONSTRAINT [LomConfig_shiftDurationSource_df] DEFAULT 'FIXED_8' FOR [shiftDurationSource];

-- AlterTable
ALTER TABLE [dbo].[LwfRate] DROP CONSTRAINT [DF_LwfRate_deductionMonth],
[DF_LwfRate_frequency],
[DF_LwfRate_isActive],
[DF_LwfRate_rateType];
EXEC SP_RENAME N'dbo.PK_LwfRate', N'LwfRate_pkey';
ALTER TABLE [dbo].[LwfRate] ADD CONSTRAINT [LwfRate_deductionMonth_df] DEFAULT 1 FOR [deductionMonth], CONSTRAINT [LwfRate_frequency_df] DEFAULT 'MONTHLY' FOR [frequency], CONSTRAINT [LwfRate_isActive_df] DEFAULT 1 FOR [isActive], CONSTRAINT [LwfRate_rateType_df] DEFAULT 'FLAT' FOR [rateType];

-- AlterTable
ALTER TABLE [dbo].[ManualArrear] DROP CONSTRAINT [DF_ManualArrear_amountType],
[DF_ManualArrear_status];
EXEC SP_RENAME N'dbo.PK_ManualArrear', N'ManualArrear_pkey';
ALTER TABLE [dbo].[ManualArrear] ADD CONSTRAINT [ManualArrear_amountType_df] DEFAULT 'EARNING' FOR [amountType], CONSTRAINT [ManualArrear_status_df] DEFAULT 'PENDING' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[MonthlyAttendanceSummary] DROP CONSTRAINT [DF_MonthlyAttendanceSummary_clDays],
[DF_MonthlyAttendanceSummary_compOffDays],
[DF_MonthlyAttendanceSummary_elDays],
[DF_MonthlyAttendanceSummary_holidayWorkedDays],
[DF_MonthlyAttendanceSummary_mlDays],
[DF_MonthlyAttendanceSummary_otherLeaveDays],
[DF_MonthlyAttendanceSummary_permissionExcessHours],
[DF_MonthlyAttendanceSummary_permissionHours],
[DF_MonthlyAttendanceSummary_plDays],
[DF_MonthlyAttendanceSummary_slDays],
[DF__MonthlyAt__payab__290D0E62],
[MonthlyAttendanceSummary_absentDays_df],
[MonthlyAttendanceSummary_leaveDays_df],
[MonthlyAttendanceSummary_lopDays_df],
[MonthlyAttendanceSummary_presentDays_df];
ALTER TABLE [dbo].[MonthlyAttendanceSummary] ALTER COLUMN [presentDays] DECIMAL(5,2) NOT NULL;
ALTER TABLE [dbo].[MonthlyAttendanceSummary] ALTER COLUMN [absentDays] DECIMAL(5,2) NOT NULL;
ALTER TABLE [dbo].[MonthlyAttendanceSummary] ALTER COLUMN [leaveDays] DECIMAL(5,2) NOT NULL;
ALTER TABLE [dbo].[MonthlyAttendanceSummary] ALTER COLUMN [lopDays] DECIMAL(5,2) NOT NULL;
ALTER TABLE [dbo].[MonthlyAttendanceSummary] ADD CONSTRAINT [MonthlyAttendanceSummary_absentDays_df] DEFAULT 0 FOR [absentDays], CONSTRAINT [MonthlyAttendanceSummary_clDays_df] DEFAULT 0 FOR [clDays], CONSTRAINT [MonthlyAttendanceSummary_compOffDays_df] DEFAULT 0 FOR [compOffDays], CONSTRAINT [MonthlyAttendanceSummary_elDays_df] DEFAULT 0 FOR [elDays], CONSTRAINT [MonthlyAttendanceSummary_holidayWorkedDays_df] DEFAULT 0 FOR [holidayWorkedDays], CONSTRAINT [MonthlyAttendanceSummary_leaveDays_df] DEFAULT 0 FOR [leaveDays], CONSTRAINT [MonthlyAttendanceSummary_lopDays_df] DEFAULT 0 FOR [lopDays], CONSTRAINT [MonthlyAttendanceSummary_mlDays_df] DEFAULT 0 FOR [mlDays], CONSTRAINT [MonthlyAttendanceSummary_otherLeaveDays_df] DEFAULT 0 FOR [otherLeaveDays], CONSTRAINT [MonthlyAttendanceSummary_payableDays_df] DEFAULT 0 FOR [payableDays], CONSTRAINT [MonthlyAttendanceSummary_permissionExcessHours_df] DEFAULT 0 FOR [permissionExcessHours], CONSTRAINT [MonthlyAttendanceSummary_permissionHours_df] DEFAULT 0 FOR [permissionHours], CONSTRAINT [MonthlyAttendanceSummary_plDays_df] DEFAULT 0 FOR [plDays], CONSTRAINT [MonthlyAttendanceSummary_presentDays_df] DEFAULT 0 FOR [presentDays], CONSTRAINT [MonthlyAttendanceSummary_slDays_df] DEFAULT 0 FOR [slDays];

-- AlterTable
ALTER TABLE [dbo].[OTIncentiveSlab] DROP CONSTRAINT [DF_OTIncentiveSlab_isActive];
EXEC SP_RENAME N'dbo.PK_OTIncentiveSlab', N'OTIncentiveSlab_pkey';
ALTER TABLE [dbo].[OTIncentiveSlab] ADD CONSTRAINT [OTIncentiveSlab_isActive_df] DEFAULT 1 FOR [isActive];

-- AlterTable
ALTER TABLE [dbo].[OTPlan] DROP CONSTRAINT [DF_OTPlan_holidayFactor],
[DF_OTPlan_otCalculationBasis],
[DF_OTPlan_weekdayFactor],
[DF_OTPlan_weeklyOffFactor],
[DF_OTPlan_weeklyOffSettlement];
ALTER TABLE [dbo].[OTPlan] ADD CONSTRAINT [OTPlan_holidayFactor_df] DEFAULT 2 FOR [holidayFactor], CONSTRAINT [OTPlan_otCalculationBasis_df] DEFAULT 'GROSS' FOR [otCalculationBasis], CONSTRAINT [OTPlan_weekdayFactor_df] DEFAULT 1 FOR [weekdayFactor], CONSTRAINT [OTPlan_weeklyOffFactor_df] DEFAULT 1.5 FOR [weeklyOffFactor], CONSTRAINT [OTPlan_weeklyOffSettlement_df] DEFAULT 'PAYMENT' FOR [weeklyOffSettlement];

-- AlterTable
ALTER TABLE [dbo].[PayrollDisplayConfig] DROP CONSTRAINT [DF_PayrollDisplayConfig_decimalPlaces],
[DF_PayrollDisplayConfig_showDeductionPercent],
[DF_PayrollDisplayConfig_showLeaveBalance],
[DF_PayrollDisplayConfig_showTaxBreakdown],
[DF_PayrollDisplayConfig_showYTD];
EXEC SP_RENAME N'dbo.PK_PayrollDisplayConfig', N'PayrollDisplayConfig_pkey';
ALTER TABLE [dbo].[PayrollDisplayConfig] ADD CONSTRAINT [PayrollDisplayConfig_decimalPlaces_df] DEFAULT 2 FOR [decimalPlaces], CONSTRAINT [PayrollDisplayConfig_showDeductionPercent_df] DEFAULT 1 FOR [showDeductionPercent], CONSTRAINT [PayrollDisplayConfig_showLeaveBalance_df] DEFAULT 0 FOR [showLeaveBalance], CONSTRAINT [PayrollDisplayConfig_showTaxBreakdown_df] DEFAULT 0 FOR [showTaxBreakdown], CONSTRAINT [PayrollDisplayConfig_showYTD_df] DEFAULT 0 FOR [showYTD];

-- AlterTable
ALTER TABLE [dbo].[PayrollLine] DROP CONSTRAINT [DF_PayrollLine_healthInsurance],
[DF_PayrollLine_licAmount],
[DF_PayrollLine_lomAmount],
[DF_PayrollLine_lwfAmount],
[DF__PayrollLi__addit__037C6257],
[DF__PayrollLi__fixed__02883E1E],
[DF__PayrollLi__perfo__04708690];
ALTER TABLE [dbo].[PayrollLine] ADD CONSTRAINT [PayrollLine_additionalGross_df] DEFAULT 0 FOR [additionalGross], CONSTRAINT [PayrollLine_fixedGross_df] DEFAULT 0 FOR [fixedGross], CONSTRAINT [PayrollLine_healthInsurance_df] DEFAULT 0 FOR [healthInsurance], CONSTRAINT [PayrollLine_licAmount_df] DEFAULT 0 FOR [licAmount], CONSTRAINT [PayrollLine_lomAmount_df] DEFAULT 0 FOR [lomAmount], CONSTRAINT [PayrollLine_lwfAmount_df] DEFAULT 0 FOR [lwfAmount], CONSTRAINT [PayrollLine_performanceIncentive_df] DEFAULT 0 FOR [performanceIncentive];

-- AlterTable
ALTER TABLE [dbo].[PayrollValidationConfig] DROP CONSTRAINT [DF_PayrollValidationConfig_allowNegativeNet],
[DF_PayrollValidationConfig_checkAttendanceFrozen],
[DF_PayrollValidationConfig_checkDuplicateComponents],
[DF_PayrollValidationConfig_checkGrossReconciliation],
[DF_PayrollValidationConfig_maxDeductionPercent],
[DF_PayrollValidationConfig_minNetPercentOfGross],
[DF_PayrollValidationConfig_requireApprovalIfNegative],
[DF_PayrollValidationConfig_statutoryIncludedInLimit],
[DF_PayrollValidationConfig_warnIfZeroGross];
EXEC SP_RENAME N'dbo.PK_PayrollValidationConfig', N'PayrollValidationConfig_pkey';
ALTER TABLE [dbo].[PayrollValidationConfig] ADD CONSTRAINT [PayrollValidationConfig_allowNegativeNet_df] DEFAULT 0 FOR [allowNegativeNet], CONSTRAINT [PayrollValidationConfig_checkAttendanceFrozen_df] DEFAULT 0 FOR [checkAttendanceFrozen], CONSTRAINT [PayrollValidationConfig_checkDuplicateComponents_df] DEFAULT 1 FOR [checkDuplicateComponents], CONSTRAINT [PayrollValidationConfig_checkGrossReconciliation_df] DEFAULT 0 FOR [checkGrossReconciliation], CONSTRAINT [PayrollValidationConfig_maxDeductionPercent_df] DEFAULT 100 FOR [maxDeductionPercent], CONSTRAINT [PayrollValidationConfig_minNetPercentOfGross_df] DEFAULT 0 FOR [minNetPercentOfGross], CONSTRAINT [PayrollValidationConfig_requireApprovalIfNegative_df] DEFAULT 1 FOR [requireApprovalIfNegative], CONSTRAINT [PayrollValidationConfig_statutoryIncludedInLimit_df] DEFAULT 1 FOR [statutoryIncludedInLimit], CONSTRAINT [PayrollValidationConfig_warnIfZeroGross_df] DEFAULT 1 FOR [warnIfZeroGross];

-- AlterTable
ALTER TABLE [dbo].[PayrollWorkflowConfig] DROP CONSTRAINT [DF_PayrollWorkflowConfig_allowReopenAfterLock],
[DF_PayrollWorkflowConfig_approvalStages],
[DF_PayrollWorkflowConfig_enablePostedStage],
[DF_PayrollWorkflowConfig_enableSubmittedStage],
[DF_PayrollWorkflowConfig_enableValidatedStage],
[DF_PayrollWorkflowConfig_reopenRequiresReason];
EXEC SP_RENAME N'dbo.PK_PayrollWorkflowConfig', N'PayrollWorkflowConfig_pkey';
ALTER TABLE [dbo].[PayrollWorkflowConfig] ADD CONSTRAINT [PayrollWorkflowConfig_allowReopenAfterLock_df] DEFAULT 1 FOR [allowReopenAfterLock], CONSTRAINT [PayrollWorkflowConfig_approvalStages_df] DEFAULT 'HR' FOR [approvalStages], CONSTRAINT [PayrollWorkflowConfig_enablePostedStage_df] DEFAULT 0 FOR [enablePostedStage], CONSTRAINT [PayrollWorkflowConfig_enableSubmittedStage_df] DEFAULT 0 FOR [enableSubmittedStage], CONSTRAINT [PayrollWorkflowConfig_enableValidatedStage_df] DEFAULT 0 FOR [enableValidatedStage], CONSTRAINT [PayrollWorkflowConfig_reopenRequiresReason_df] DEFAULT 1 FOR [reopenRequiresReason];

-- AlterTable
ALTER TABLE [dbo].[PermissionRequest] DROP CONSTRAINT [PermissionRequest_status_df];
ALTER TABLE [dbo].[PermissionRequest] ADD CONSTRAINT [PermissionRequest_status_df] DEFAULT 'pending_manager' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[PetrolAllowanceEntry] DROP CONSTRAINT [DF_PetrolAllowanceEntry_status];
EXEC SP_RENAME N'dbo.PK_PetrolAllowanceEntry', N'PetrolAllowanceEntry_pkey';
ALTER TABLE [dbo].[PetrolAllowanceEntry] ADD CONSTRAINT [PetrolAllowanceEntry_status_df] DEFAULT 'PENDING' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[PlatformDocumentType] DROP COLUMN [businessCategory],
[uploadMode];

-- AlterTable
ALTER TABLE [dbo].[RoundingConfig] DROP CONSTRAINT [DF_RoundingConfig_applyTo],
[DF_RoundingConfig_roundingMode],
[DF_RoundingConfig_showRoundOff];
EXEC SP_RENAME N'dbo.PK_RoundingConfig', N'RoundingConfig_pkey';
ALTER TABLE [dbo].[RoundingConfig] ADD CONSTRAINT [RoundingConfig_applyTo_df] DEFAULT 'NET_ONLY' FOR [applyTo], CONSTRAINT [RoundingConfig_roundingMode_df] DEFAULT 'NEAREST_1' FOR [roundingMode], CONSTRAINT [RoundingConfig_showRoundOff_df] DEFAULT 1 FOR [showRoundOff];

-- AlterTable
ALTER TABLE [dbo].[SalaryComponent] DROP CONSTRAINT [DF__SalaryCom__gross__019419E5],
[DF__SalaryCom__inclu__009FF5AC];
ALTER TABLE [dbo].[SalaryComponent] DROP COLUMN [fnfPayable],
[fnfProration],
[fnfTaxable];
ALTER TABLE [dbo].[SalaryComponent] ADD CONSTRAINT [SalaryComponent_grossTier_df] DEFAULT 'ADDITIONAL' FOR [grossTier], CONSTRAINT [SalaryComponent_includeInGross_df] DEFAULT 1 FOR [includeInGross];

-- AlterTable
ALTER TABLE [dbo].[ShiftAssignmentOverride] DROP CONSTRAINT [DF__ShiftAssi__creat__51700577];
EXEC SP_RENAME N'dbo.PK_ShiftAssignmentOverride', N'ShiftAssignmentOverride_pkey';
ALTER TABLE [dbo].[ShiftAssignmentOverride] ADD CONSTRAINT [ShiftAssignmentOverride_createdAt_df] DEFAULT CURRENT_TIMESTAMP FOR [createdAt];

-- AlterTable
ALTER TABLE [dbo].[ShiftChangeNotification] DROP CONSTRAINT [DF__ShiftChan__creat__75AD65ED],
[DF__ShiftChan__isRea__74B941B4];
EXEC SP_RENAME N'dbo.PK_ShiftChangeNotification', N'ShiftChangeNotification_pkey';
ALTER TABLE [dbo].[ShiftChangeNotification] ADD CONSTRAINT [ShiftChangeNotification_createdAt_df] DEFAULT CURRENT_TIMESTAMP FOR [createdAt], CONSTRAINT [ShiftChangeNotification_isRead_df] DEFAULT 0 FOR [isRead];

-- AlterTable
ALTER TABLE [dbo].[ShiftChangeRequest] DROP CONSTRAINT [DF__ShiftChan__creat__5CE1B823],
[DF__ShiftChan__curre__5BED93EA],
[DF__ShiftChan__statu__5AF96FB1];
EXEC SP_RENAME N'dbo.PK_ShiftChangeRequest', N'ShiftChangeRequest_pkey';
ALTER TABLE [dbo].[ShiftChangeRequest] ADD CONSTRAINT [ShiftChangeRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP FOR [createdAt], CONSTRAINT [ShiftChangeRequest_currentStageOrder_df] DEFAULT 1 FOR [currentStageOrder], CONSTRAINT [ShiftChangeRequest_status_df] DEFAULT 'pending' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[ShiftMaster] DROP CONSTRAINT [DF_ShiftMaster_breakMinutes];
ALTER TABLE [dbo].[ShiftMaster] ADD CONSTRAINT [ShiftMaster_breakMinutes_df] DEFAULT 0 FOR [breakMinutes];

-- AlterTable
ALTER TABLE [dbo].[StatePtConfig] DROP CONSTRAINT [DF_StatePtConfig_isActive];
EXEC SP_RENAME N'dbo.PK_StatePtConfig', N'StatePtConfig_pkey';
ALTER TABLE [dbo].[StatePtConfig] ADD CONSTRAINT [StatePtConfig_isActive_df] DEFAULT 1 FOR [isActive];

-- AlterTable
ALTER TABLE [dbo].[TdsInvestmentDeclaration] DROP CONSTRAINT [DF_TdsInvestmentDeclaration_hraExemption],
[DF_TdsInvestmentDeclaration_otherDeductions],
[DF_TdsInvestmentDeclaration_otherIncome],
[DF_TdsInvestmentDeclaration_regime],
[DF_TdsInvestmentDeclaration_section80CCD],
[DF_TdsInvestmentDeclaration_section80C],
[DF_TdsInvestmentDeclaration_section80D],
[DF_TdsInvestmentDeclaration_section80E],
[DF_TdsInvestmentDeclaration_section80G],
[DF_TdsInvestmentDeclaration_section80TTA],
[DF_TdsInvestmentDeclaration_status];
EXEC SP_RENAME N'dbo.PK_TdsInvestmentDeclaration', N'TdsInvestmentDeclaration_pkey';
ALTER TABLE [dbo].[TdsInvestmentDeclaration] ADD CONSTRAINT [TdsInvestmentDeclaration_hraExemption_df] DEFAULT 0 FOR [hraExemption], CONSTRAINT [TdsInvestmentDeclaration_otherDeductions_df] DEFAULT 0 FOR [otherDeductions], CONSTRAINT [TdsInvestmentDeclaration_otherIncome_df] DEFAULT 0 FOR [otherIncome], CONSTRAINT [TdsInvestmentDeclaration_regime_df] DEFAULT 'NEW' FOR [regime], CONSTRAINT [TdsInvestmentDeclaration_section80CCD_df] DEFAULT 0 FOR [section80CCD], CONSTRAINT [TdsInvestmentDeclaration_section80C_df] DEFAULT 0 FOR [section80C], CONSTRAINT [TdsInvestmentDeclaration_section80D_df] DEFAULT 0 FOR [section80D], CONSTRAINT [TdsInvestmentDeclaration_section80E_df] DEFAULT 0 FOR [section80E], CONSTRAINT [TdsInvestmentDeclaration_section80G_df] DEFAULT 0 FOR [section80G], CONSTRAINT [TdsInvestmentDeclaration_section80TTA_df] DEFAULT 0 FOR [section80TTA], CONSTRAINT [TdsInvestmentDeclaration_status_df] DEFAULT 'pending_hr' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[TdsInvestmentProof] DROP CONSTRAINT [DF_TdsInvestmentProof_status];
EXEC SP_RENAME N'dbo.PK_TdsInvestmentProof', N'TdsInvestmentProof_pkey';
ALTER TABLE [dbo].[TdsInvestmentProof] ADD CONSTRAINT [TdsInvestmentProof_status_df] DEFAULT 'pending' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[TdsRegimeConfig] DROP CONSTRAINT [DF_TdsRegimeConfig_cessRate],
[DF_TdsRegimeConfig_defaultRegime],
[DF_TdsRegimeConfig_financialYearStart],
[DF_TdsRegimeConfig_isActive],
[DF_TdsRegimeConfig_rebateAmount],
[DF_TdsRegimeConfig_rebateUptoIncome],
[DF_TdsRegimeConfig_standardDeduction],
[DF_TdsRegimeConfig_surchargeRate],
[DF_TdsRegimeConfig_surchargeThreshold];
EXEC SP_RENAME N'dbo.PK_TdsRegimeConfig', N'TdsRegimeConfig_pkey';
ALTER TABLE [dbo].[TdsRegimeConfig] ADD CONSTRAINT [TdsRegimeConfig_cessRate_df] DEFAULT 4 FOR [cessRate], CONSTRAINT [TdsRegimeConfig_defaultRegime_df] DEFAULT 'NEW' FOR [defaultRegime], CONSTRAINT [TdsRegimeConfig_financialYearStart_df] DEFAULT 4 FOR [financialYearStart], CONSTRAINT [TdsRegimeConfig_isActive_df] DEFAULT 1 FOR [isActive], CONSTRAINT [TdsRegimeConfig_rebateAmount_df] DEFAULT 12500 FOR [rebateAmount], CONSTRAINT [TdsRegimeConfig_rebateUptoIncome_df] DEFAULT 500000 FOR [rebateUptoIncome], CONSTRAINT [TdsRegimeConfig_standardDeduction_df] DEFAULT 50000 FOR [standardDeduction], CONSTRAINT [TdsRegimeConfig_surchargeRate_df] DEFAULT 10 FOR [surchargeRate], CONSTRAINT [TdsRegimeConfig_surchargeThreshold_df] DEFAULT 5000000 FOR [surchargeThreshold];

-- AlterTable
ALTER TABLE [dbo].[VisitorGatePass] DROP CONSTRAINT [VisitorGatePass_status_df];
ALTER TABLE [dbo].[VisitorGatePass] ADD CONSTRAINT [VisitorGatePass_status_df] DEFAULT 'DRAFT' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[VisitorNotificationLog] DROP CONSTRAINT [DF__VisitorNo__chann__384F51F2],
[DF__VisitorNo__statu__3943762B];
EXEC SP_RENAME N'dbo.PK__VisitorN__3213E83F51CE4656', N'VisitorNotificationLog_pkey';
ALTER TABLE [dbo].[VisitorNotificationLog] ADD CONSTRAINT [VisitorNotificationLog_channel_df] DEFAULT 'IN_APP' FOR [channel], CONSTRAINT [VisitorNotificationLog_status_df] DEFAULT 'PENDING' FOR [status];

-- AlterTable
ALTER TABLE [dbo].[YearlyLeaveCalendar] DROP CONSTRAINT [DF__YearlyLea__creat__6E0C4425],
[DF__YearlyLea__isAct__6D181FEC];
EXEC SP_RENAME N'dbo.PK_YearlyLeaveCalendar', N'YearlyLeaveCalendar_pkey';
ALTER TABLE [dbo].[YearlyLeaveCalendar] ADD CONSTRAINT [YearlyLeaveCalendar_createdAt_df] DEFAULT CURRENT_TIMESTAMP FOR [createdAt], CONSTRAINT [YearlyLeaveCalendar_isActive_df] DEFAULT 1 FOR [isActive];

-- RedefineTables
BEGIN TRANSACTION;
DROP INDEX [Assessment_companyId_trainingProgramId_idx] ON [dbo].[Assessment];
DROP INDEX [Assessment_companyId_trainingScheduleId_idx] ON [dbo].[Assessment];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'Assessment'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_Assessment] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [trainingProgramId] INT,
    [trainingScheduleId] INT,
    [title] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(500),
    [assessmentType] NVARCHAR(20),
    [passingScore] INT NOT NULL,
    [durationMinutes] INT,
    [questionIds] NVARCHAR(max),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Assessment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Assessment_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[Assessment])
    EXEC('INSERT INTO [dbo].[_prisma_new_Assessment] ([assessmentType],[companyId],[createdAt],[deletedAt],[description],[durationMinutes],[id],[isActive],[passingScore],[questionIds],[title],[trainingProgramId],[trainingScheduleId],[updatedAt]) SELECT [assessmentType],[companyId],[createdAt],[deletedAt],[description],[durationMinutes],[id],[isActive],[passingScore],[questionIds],[title],[trainingProgramId],[trainingScheduleId],[updatedAt] FROM [dbo].[Assessment] WITH (holdlock tablockx)');
DROP TABLE [dbo].[Assessment];
EXEC SP_RENAME N'dbo._prisma_new_Assessment', N'Assessment';
CREATE NONCLUSTERED INDEX [Assessment_companyId_trainingProgramId_idx] ON [dbo].[Assessment]([companyId], [trainingProgramId]);
CREATE NONCLUSTERED INDEX [Assessment_companyId_trainingScheduleId_idx] ON [dbo].[Assessment]([companyId], [trainingScheduleId]);
DROP INDEX [AssessmentAttempt_companyId_assessmentId_employeeId_key] ON [dbo].[AssessmentAttempt];
DROP INDEX [AssessmentAttempt_companyId_employeeId_idx] ON [dbo].[AssessmentAttempt];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'AssessmentAttempt'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_AssessmentAttempt] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [assessmentId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [answersJson] NVARCHAR(max),
    [totalScore] INT NOT NULL,
    [maxScore] INT NOT NULL,
    [scorePercent] INT NOT NULL,
    [result] NVARCHAR(20) NOT NULL,
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [AssessmentAttempt_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [submittedAt] DATETIME2,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssessmentAttempt_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AssessmentAttempt_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[AssessmentAttempt])
    EXEC('INSERT INTO [dbo].[_prisma_new_AssessmentAttempt] ([answersJson],[assessmentId],[companyId],[createdAt],[deletedAt],[employeeId],[id],[isActive],[maxScore],[result],[scorePercent],[startedAt],[submittedAt],[totalScore],[updatedAt]) SELECT [answersJson],[assessmentId],[companyId],[createdAt],[deletedAt],[employeeId],[id],[isActive],[maxScore],[result],[scorePercent],[startedAt],[submittedAt],[totalScore],[updatedAt] FROM [dbo].[AssessmentAttempt] WITH (holdlock tablockx)');
DROP TABLE [dbo].[AssessmentAttempt];
EXEC SP_RENAME N'dbo._prisma_new_AssessmentAttempt', N'AssessmentAttempt';
CREATE NONCLUSTERED INDEX [AssessmentAttempt_companyId_assessmentId_employeeId_idx] ON [dbo].[AssessmentAttempt]([companyId], [assessmentId], [employeeId]);
CREATE NONCLUSTERED INDEX [AssessmentAttempt_companyId_employeeId_idx] ON [dbo].[AssessmentAttempt]([companyId], [employeeId]);
DROP INDEX [Competency_companyId_category_idx] ON [dbo].[Competency];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'Competency'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_Competency] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20),
    [name] NVARCHAR(100) NOT NULL,
    [category] NVARCHAR(50) NOT NULL,
    [type] NVARCHAR(50),
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Competency_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Competency_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[Competency])
    EXEC('INSERT INTO [dbo].[_prisma_new_Competency] ([category],[code],[companyId],[createdAt],[deletedAt],[description],[id],[isActive],[name],[type],[updatedAt]) SELECT [category],[code],[companyId],[createdAt],[deletedAt],[description],[id],[isActive],[name],[type],[updatedAt] FROM [dbo].[Competency] WITH (holdlock tablockx)');
DROP TABLE [dbo].[Competency];
EXEC SP_RENAME N'dbo._prisma_new_Competency', N'Competency';
CREATE NONCLUSTERED INDEX [Competency_companyId_category_idx] ON [dbo].[Competency]([companyId], [category]);
DROP INDEX [CompetencyRequirement_companyId_competencyId_idx] ON [dbo].[CompetencyRequirement];
DROP INDEX [CompetencyRequirement_companyId_departmentId_designationId_gradeId_idx] ON [dbo].[CompetencyRequirement];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'CompetencyRequirement'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_CompetencyRequirement] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [competencyId] INT NOT NULL,
    [departmentId] INT,
    [designationId] INT,
    [gradeId] INT,
    [requiredLevelId] INT NOT NULL,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CompetencyRequirement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CompetencyRequirement_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[CompetencyRequirement])
    EXEC('INSERT INTO [dbo].[_prisma_new_CompetencyRequirement] ([companyId],[competencyId],[createdAt],[deletedAt],[departmentId],[designationId],[gradeId],[id],[isActive],[requiredLevelId],[updatedAt]) SELECT [companyId],[competencyId],[createdAt],[deletedAt],[departmentId],[designationId],[gradeId],[id],[isActive],[requiredLevelId],[updatedAt] FROM [dbo].[CompetencyRequirement] WITH (holdlock tablockx)');
DROP TABLE [dbo].[CompetencyRequirement];
EXEC SP_RENAME N'dbo._prisma_new_CompetencyRequirement', N'CompetencyRequirement';
CREATE NONCLUSTERED INDEX [CompetencyRequirement_companyId_competencyId_idx] ON [dbo].[CompetencyRequirement]([companyId], [competencyId]);
CREATE NONCLUSTERED INDEX [CompetencyRequirement_companyId_departmentId_designationId_gradeId_idx] ON [dbo].[CompetencyRequirement]([companyId], [departmentId], [designationId], [gradeId]);
ALTER TABLE [dbo].[EmployeeCompetency] DROP CONSTRAINT [EmployeeCompetency_companyId_employeeId_competencyId_key];
DROP INDEX [EmployeeCompetency_employeeId_idx] ON [dbo].[EmployeeCompetency];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'EmployeeCompetency'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_EmployeeCompetency] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [competencyId] INT NOT NULL,
    [currentLevelId] INT NOT NULL,
    [targetLevelId] INT,
    [certificationNumber] NVARCHAR(50),
    [certifiedDate] DATETIME2,
    [expiryDate] DATETIME2,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeCompetency_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeCompetency_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeCompetency_companyId_key] UNIQUE NONCLUSTERED ([companyId]),
    CONSTRAINT [EmployeeCompetency_employeeId_key] UNIQUE NONCLUSTERED ([employeeId]),
    CONSTRAINT [EmployeeCompetency_competencyId_key] UNIQUE NONCLUSTERED ([competencyId])
);
IF EXISTS(SELECT * FROM [dbo].[EmployeeCompetency])
    EXEC('INSERT INTO [dbo].[_prisma_new_EmployeeCompetency] ([certificationNumber],[certifiedDate],[companyId],[competencyId],[createdAt],[currentLevelId],[deletedAt],[employeeId],[expiryDate],[id],[isActive],[targetLevelId],[updatedAt]) SELECT [certificationNumber],[certifiedDate],[companyId],[competencyId],[createdAt],[currentLevelId],[deletedAt],[employeeId],[expiryDate],[id],[isActive],[targetLevelId],[updatedAt] FROM [dbo].[EmployeeCompetency] WITH (holdlock tablockx)');
DROP TABLE [dbo].[EmployeeCompetency];
EXEC SP_RENAME N'dbo._prisma_new_EmployeeCompetency', N'EmployeeCompetency';
CREATE NONCLUSTERED INDEX [EmployeeCompetency_employeeId_idx] ON [dbo].[EmployeeCompetency]([employeeId]);
ALTER TABLE [dbo].[EmployeeCtcComponent] DROP CONSTRAINT [EmployeeCtcComponent_employeeCtcId_salaryComponentId_key];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'EmployeeCtcComponent'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_EmployeeCtcComponent] (
    [id] INT NOT NULL,
    [employeeCtcId] INT NOT NULL,
    [salaryComponentId] INT NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    CONSTRAINT [EmployeeCtcComponent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeCtcComponent_employeeCtcId_key] UNIQUE NONCLUSTERED ([employeeCtcId]),
    CONSTRAINT [EmployeeCtcComponent_salaryComponentId_key] UNIQUE NONCLUSTERED ([salaryComponentId])
);
IF EXISTS(SELECT * FROM [dbo].[EmployeeCtcComponent])
    EXEC('INSERT INTO [dbo].[_prisma_new_EmployeeCtcComponent] ([amount],[employeeCtcId],[id],[salaryComponentId]) SELECT [amount],[employeeCtcId],[id],[salaryComponentId] FROM [dbo].[EmployeeCtcComponent] WITH (holdlock tablockx)');
DROP TABLE [dbo].[EmployeeCtcComponent];
EXEC SP_RENAME N'dbo._prisma_new_EmployeeCtcComponent', N'EmployeeCtcComponent';
DROP INDEX [EmployeeKraCycle_companyId_employeeId_financialYear_periodLabel_key] ON [dbo].[EmployeeKraCycle];
DROP INDEX [EmployeeKraCycle_companyId_status_idx] ON [dbo].[EmployeeKraCycle];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'EmployeeKraCycle'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_EmployeeKraCycle] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [financialYear] NVARCHAR(9) NOT NULL,
    [periodLabel] NVARCHAR(20) NOT NULL,
    [status] NVARCHAR(20) NOT NULL,
    [overallScore] DECIMAL(6,2),
    [managerRemark] NVARCHAR(1000),
    [submittedAt] DATETIME2,
    [lockedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraCycle_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraCycle_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [EmployeeKraCycle_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[EmployeeKraCycle])
    EXEC('INSERT INTO [dbo].[_prisma_new_EmployeeKraCycle] ([companyId],[createdAt],[employeeId],[financialYear],[id],[lockedAt],[managerRemark],[overallScore],[periodLabel],[status],[submittedAt],[updatedAt]) SELECT [companyId],[createdAt],[employeeId],[financialYear],[id],[lockedAt],[managerRemark],[overallScore],[periodLabel],[status],[submittedAt],[updatedAt] FROM [dbo].[EmployeeKraCycle] WITH (holdlock tablockx)');
DROP TABLE [dbo].[EmployeeKraCycle];
EXEC SP_RENAME N'dbo._prisma_new_EmployeeKraCycle', N'EmployeeKraCycle';
CREATE NONCLUSTERED INDEX [EmployeeKraCycle_companyId_employeeId_financialYear_periodLabel_idx] ON [dbo].[EmployeeKraCycle]([companyId], [employeeId], [financialYear], [periodLabel]);
CREATE NONCLUSTERED INDEX [EmployeeKraCycle_companyId_status_idx] ON [dbo].[EmployeeKraCycle]([companyId], [status]);
DROP INDEX [EmployeeKraLine_cycleId_idx] ON [dbo].[EmployeeKraLine];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'EmployeeKraLine'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_EmployeeKraLine] (
    [id] INT NOT NULL,
    [cycleId] INT NOT NULL,
    [kpiTemplateId] INT,
    [goalId] INT,
    [name] NVARCHAR(200) NOT NULL,
    [weightage] DECIMAL(5,2) NOT NULL,
    [targetValue] NVARCHAR(100),
    [actualValue] NVARCHAR(100),
    [score] DECIMAL(6,2),
    [maxScore] DECIMAL(6,2) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeKraLine_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [EmployeeKraLine_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[EmployeeKraLine])
    EXEC('INSERT INTO [dbo].[_prisma_new_EmployeeKraLine] ([actualValue],[createdAt],[cycleId],[goalId],[id],[kpiTemplateId],[maxScore],[name],[score],[targetValue],[updatedAt],[weightage]) SELECT [actualValue],[createdAt],[cycleId],[goalId],[id],[kpiTemplateId],[maxScore],[name],[score],[targetValue],[updatedAt],[weightage] FROM [dbo].[EmployeeKraLine] WITH (holdlock tablockx)');
DROP TABLE [dbo].[EmployeeKraLine];
EXEC SP_RENAME N'dbo._prisma_new_EmployeeKraLine', N'EmployeeKraLine';
CREATE NONCLUSTERED INDEX [EmployeeKraLine_cycleId_idx] ON [dbo].[EmployeeKraLine]([cycleId]);
ALTER TABLE [dbo].[ExitClearanceCheck] DROP CONSTRAINT [ExitClearanceCheck_exitInterviewId_checkCode_key];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'ExitClearanceCheck'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_ExitClearanceCheck] (
    [id] INT NOT NULL,
    [exitInterviewId] INT NOT NULL,
    [checkCode] NVARCHAR(20) NOT NULL,
    [status] NVARCHAR(20) NOT NULL,
    [remark] NVARCHAR(500),
    [clearedByUserId] INT,
    [clearedAt] DATETIME2,
    CONSTRAINT [ExitClearanceCheck_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ExitClearanceCheck_exitInterviewId_key] UNIQUE NONCLUSTERED ([exitInterviewId]),
    CONSTRAINT [ExitClearanceCheck_checkCode_key] UNIQUE NONCLUSTERED ([checkCode])
);
IF EXISTS(SELECT * FROM [dbo].[ExitClearanceCheck])
    EXEC('INSERT INTO [dbo].[_prisma_new_ExitClearanceCheck] ([checkCode],[clearedAt],[clearedByUserId],[exitInterviewId],[id],[remark],[status]) SELECT [checkCode],[clearedAt],[clearedByUserId],[exitInterviewId],[id],[remark],[status] FROM [dbo].[ExitClearanceCheck] WITH (holdlock tablockx)');
DROP TABLE [dbo].[ExitClearanceCheck];
EXEC SP_RENAME N'dbo._prisma_new_ExitClearanceCheck', N'ExitClearanceCheck';
DROP INDEX [IX_ExpenseReimbursement_companyId_employeeId_status] ON [dbo].[ExpenseReimbursement];
DROP INDEX [IX_ExpenseReimbursement_employeeId_submissionDate] ON [dbo].[ExpenseReimbursement];
DROP INDEX [IX_ExpenseReimbursement_status] ON [dbo].[ExpenseReimbursement];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'ExpenseReimbursement'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_ExpenseReimbursement] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL,
    [submissionDate] DATETIME2 NOT NULL,
    [purpose] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(max),
    [totalAmount] DECIMAL(18,2) NOT NULL,
    [approvedAmount] DECIMAL(18,2),
    [approvedBy] INT,
    [approvalDate] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [paymentDate] DATETIME2,
    [createdByUserId] INT,
    [createdAt] DATETIME2 NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [ExpenseReimbursement_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[ExpenseReimbursement])
    EXEC('INSERT INTO [dbo].[_prisma_new_ExpenseReimbursement] ([approvalDate],[approvedAmount],[approvedBy],[companyId],[createdAt],[createdByUserId],[deletedAt],[description],[employeeId],[id],[paymentDate],[purpose],[rejectionReason],[status],[submissionDate],[totalAmount],[updatedAt]) SELECT [approvalDate],[approvedAmount],[approvedBy],[companyId],[createdAt],[createdByUserId],[deletedAt],[description],[employeeId],[id],[paymentDate],[purpose],[rejectionReason],[status],[submissionDate],[totalAmount],[updatedAt] FROM [dbo].[ExpenseReimbursement] WITH (holdlock tablockx)');
DROP TABLE [dbo].[ExpenseReimbursement];
EXEC SP_RENAME N'dbo._prisma_new_ExpenseReimbursement', N'ExpenseReimbursement';
CREATE NONCLUSTERED INDEX [ExpenseReimbursement_companyId_employeeId_status_idx] ON [dbo].[ExpenseReimbursement]([companyId], [employeeId], [status]);
CREATE NONCLUSTERED INDEX [ExpenseReimbursement_employeeId_submissionDate_idx] ON [dbo].[ExpenseReimbursement]([employeeId], [submissionDate]);
CREATE NONCLUSTERED INDEX [ExpenseReimbursement_status_idx] ON [dbo].[ExpenseReimbursement]([status]);
DROP INDEX [IX_ExpenseReimbursementItem_expenseReimbursementId] ON [dbo].[ExpenseReimbursementItem];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'ExpenseReimbursementItem'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_ExpenseReimbursementItem] (
    [id] INT NOT NULL,
    [expenseReimbursementId] INT NOT NULL,
    [category] NVARCHAR(30) NOT NULL,
    [description] NVARCHAR(500) NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [receiptDate] DATE NOT NULL,
    [receiptAttachmentPath] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ExpenseReimbursementItem_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[ExpenseReimbursementItem])
    EXEC('INSERT INTO [dbo].[_prisma_new_ExpenseReimbursementItem] ([amount],[category],[createdAt],[description],[expenseReimbursementId],[id],[receiptAttachmentPath],[receiptDate],[updatedAt]) SELECT [amount],[category],[createdAt],[description],[expenseReimbursementId],[id],[receiptAttachmentPath],[receiptDate],[updatedAt] FROM [dbo].[ExpenseReimbursementItem] WITH (holdlock tablockx)');
DROP TABLE [dbo].[ExpenseReimbursementItem];
EXEC SP_RENAME N'dbo._prisma_new_ExpenseReimbursementItem', N'ExpenseReimbursementItem';
CREATE NONCLUSTERED INDEX [ExpenseReimbursementItem_expenseReimbursementId_idx] ON [dbo].[ExpenseReimbursementItem]([expenseReimbursementId]);
DROP INDEX [FnFSettlementLine_settlementId_idx] ON [dbo].[FnFSettlementLine];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'FnFSettlementLine'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_FnFSettlementLine] (
    [id] INT NOT NULL,
    [settlementId] INT NOT NULL,
    [kind] NVARCHAR(20) NOT NULL,
    [code] NVARCHAR(40) NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [source] NVARCHAR(20) NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [editable] BIT NOT NULL,
    [remark] NVARCHAR(500),
    [sortOrder] INT NOT NULL,
    CONSTRAINT [FnFSettlementLine_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[FnFSettlementLine])
    EXEC('INSERT INTO [dbo].[_prisma_new_FnFSettlementLine] ([amount],[code],[editable],[id],[kind],[name],[remark],[settlementId],[sortOrder],[source]) SELECT [amount],[code],[editable],[id],[kind],[name],[remark],[settlementId],[sortOrder],[source] FROM [dbo].[FnFSettlementLine] WITH (holdlock tablockx)');
DROP TABLE [dbo].[FnFSettlementLine];
EXEC SP_RENAME N'dbo._prisma_new_FnFSettlementLine', N'FnFSettlementLine';
CREATE NONCLUSTERED INDEX [FnFSettlementLine_settlementId_idx] ON [dbo].[FnFSettlementLine]([settlementId]);
DROP INDEX [GeneratedHrLetter_applicantId_idx] ON [dbo].[GeneratedHrLetter];
DROP INDEX [GeneratedHrLetter_companyId_letterType_idx] ON [dbo].[GeneratedHrLetter];
DROP INDEX [GeneratedHrLetter_companyId_referenceNo_key] ON [dbo].[GeneratedHrLetter];
DROP INDEX [GeneratedHrLetter_employeeId_idx] ON [dbo].[GeneratedHrLetter];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'GeneratedHrLetter'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_GeneratedHrLetter] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [letterType] NVARCHAR(40) NOT NULL,
    [referenceNo] NVARCHAR(60) NOT NULL,
    [employeeId] INT,
    [applicantId] INT,
    [issuedDate] DATE NOT NULL,
    [purpose] NVARCHAR(200),
    [bodySnapshot] NVARCHAR(max) NOT NULL,
    [platformDocumentId] INT,
    [issuedByUserId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GeneratedHrLetter_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [GeneratedHrLetter_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[GeneratedHrLetter])
    EXEC('INSERT INTO [dbo].[_prisma_new_GeneratedHrLetter] ([applicantId],[bodySnapshot],[companyId],[createdAt],[employeeId],[id],[issuedByUserId],[issuedDate],[letterType],[platformDocumentId],[purpose],[referenceNo]) SELECT [applicantId],[bodySnapshot],[companyId],[createdAt],[employeeId],[id],[issuedByUserId],[issuedDate],[letterType],[platformDocumentId],[purpose],[referenceNo] FROM [dbo].[GeneratedHrLetter] WITH (holdlock tablockx)');
DROP TABLE [dbo].[GeneratedHrLetter];
EXEC SP_RENAME N'dbo._prisma_new_GeneratedHrLetter', N'GeneratedHrLetter';
CREATE NONCLUSTERED INDEX [GeneratedHrLetter_applicantId_idx] ON [dbo].[GeneratedHrLetter]([applicantId]);
CREATE NONCLUSTERED INDEX [GeneratedHrLetter_companyId_letterType_idx] ON [dbo].[GeneratedHrLetter]([companyId], [letterType]);
CREATE NONCLUSTERED INDEX [GeneratedHrLetter_companyId_referenceNo_idx] ON [dbo].[GeneratedHrLetter]([companyId], [referenceNo]);
CREATE NONCLUSTERED INDEX [GeneratedHrLetter_employeeId_idx] ON [dbo].[GeneratedHrLetter]([employeeId]);
DROP INDEX [InductionAssignment_companyId_employeeId_idx] ON [dbo].[InductionAssignment];
DROP INDEX [InductionAssignment_companyId_inductionProgramId_employeeId_key] ON [dbo].[InductionAssignment];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'InductionAssignment'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_InductionAssignment] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [inductionProgramId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [assignedDate] DATETIME2 NOT NULL CONSTRAINT [InductionAssignment_assignedDate_df] DEFAULT CURRENT_TIMESTAMP,
    [targetDate] DATE,
    [completedDate] DATE,
    [status] NVARCHAR(20) NOT NULL,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InductionAssignment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [InductionAssignment_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[InductionAssignment])
    EXEC('INSERT INTO [dbo].[_prisma_new_InductionAssignment] ([assignedDate],[companyId],[completedDate],[createdAt],[deletedAt],[employeeId],[id],[inductionProgramId],[isActive],[status],[targetDate],[updatedAt]) SELECT [assignedDate],[companyId],[completedDate],[createdAt],[deletedAt],[employeeId],[id],[inductionProgramId],[isActive],[status],[targetDate],[updatedAt] FROM [dbo].[InductionAssignment] WITH (holdlock tablockx)');
DROP TABLE [dbo].[InductionAssignment];
EXEC SP_RENAME N'dbo._prisma_new_InductionAssignment', N'InductionAssignment';
CREATE NONCLUSTERED INDEX [InductionAssignment_companyId_employeeId_idx] ON [dbo].[InductionAssignment]([companyId], [employeeId]);
CREATE NONCLUSTERED INDEX [InductionAssignment_companyId_inductionProgramId_employeeId_idx] ON [dbo].[InductionAssignment]([companyId], [inductionProgramId], [employeeId]);
DROP INDEX [InductionProgram_companyId_departmentId_idx] ON [dbo].[InductionProgram];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'InductionProgram'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_InductionProgram] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [departmentId] INT,
    [designationId] INT,
    [durationDays] INT,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InductionProgram_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [InductionProgram_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[InductionProgram])
    EXEC('INSERT INTO [dbo].[_prisma_new_InductionProgram] ([companyId],[createdAt],[deletedAt],[departmentId],[description],[designationId],[durationDays],[id],[isActive],[name],[updatedAt]) SELECT [companyId],[createdAt],[deletedAt],[departmentId],[description],[designationId],[durationDays],[id],[isActive],[name],[updatedAt] FROM [dbo].[InductionProgram] WITH (holdlock tablockx)');
DROP TABLE [dbo].[InductionProgram];
EXEC SP_RENAME N'dbo._prisma_new_InductionProgram', N'InductionProgram';
CREATE NONCLUSTERED INDEX [InductionProgram_companyId_departmentId_idx] ON [dbo].[InductionProgram]([companyId], [departmentId]);
DROP INDEX [KpiGoal_companyId_isActive_idx] ON [dbo].[KpiGoal];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'KpiGoal'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_KpiGoal] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [measurementCriteria] NVARCHAR(500) NOT NULL,
    [monitoringFrequency] NVARCHAR(20) NOT NULL,
    [reportingFrequency] NVARCHAR(20) NOT NULL,
    [responsibility] NVARCHAR(200),
    [condition] NVARCHAR(200),
    [targetValue] NVARCHAR(100),
    [isActive] BIT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [KpiGoal_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [KpiGoal_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [KpiGoal_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[KpiGoal])
    EXEC('INSERT INTO [dbo].[_prisma_new_KpiGoal] ([companyId],[condition],[createdAt],[id],[isActive],[measurementCriteria],[monitoringFrequency],[name],[reportingFrequency],[responsibility],[targetValue],[updatedAt]) SELECT [companyId],[condition],[createdAt],[id],[isActive],[measurementCriteria],[monitoringFrequency],[name],[reportingFrequency],[responsibility],[targetValue],[updatedAt] FROM [dbo].[KpiGoal] WITH (holdlock tablockx)');
DROP TABLE [dbo].[KpiGoal];
EXEC SP_RENAME N'dbo._prisma_new_KpiGoal', N'KpiGoal';
CREATE NONCLUSTERED INDEX [KpiGoal_companyId_isActive_idx] ON [dbo].[KpiGoal]([companyId], [isActive]);
DROP INDEX [KpiTemplate_companyId_code_key] ON [dbo].[KpiTemplate];
DROP INDEX [KpiTemplate_companyId_kpiFor_idx] ON [dbo].[KpiTemplate];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'KpiTemplate'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_KpiTemplate] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [code] NVARCHAR(30) NOT NULL,
    [kpiFor] NVARCHAR(20) NOT NULL,
    [departmentId] INT,
    [designationId] INT,
    [criteria] NVARCHAR(500) NOT NULL,
    [targetValue] NVARCHAR(100),
    [kpiType] NVARCHAR(20) NOT NULL,
    [required] BIT NOT NULL,
    [isActive] BIT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [KpiTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [KpiTemplate_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [KpiTemplate_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[KpiTemplate])
    EXEC('INSERT INTO [dbo].[_prisma_new_KpiTemplate] ([code],[companyId],[createdAt],[criteria],[departmentId],[designationId],[id],[isActive],[kpiFor],[kpiType],[required],[targetValue],[updatedAt]) SELECT [code],[companyId],[createdAt],[criteria],[departmentId],[designationId],[id],[isActive],[kpiFor],[kpiType],[required],[targetValue],[updatedAt] FROM [dbo].[KpiTemplate] WITH (holdlock tablockx)');
DROP TABLE [dbo].[KpiTemplate];
EXEC SP_RENAME N'dbo._prisma_new_KpiTemplate', N'KpiTemplate';
CREATE NONCLUSTERED INDEX [KpiTemplate_companyId_code_idx] ON [dbo].[KpiTemplate]([companyId], [code]);
CREATE NONCLUSTERED INDEX [KpiTemplate_companyId_kpiFor_idx] ON [dbo].[KpiTemplate]([companyId], [kpiFor]);
DROP INDEX [OjtAssignment_companyId_employeeId_idx] ON [dbo].[OjtAssignment];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'OjtAssignment'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_OjtAssignment] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [mentorEmployeeId] INT,
    [trainerId] INT,
    [competencyId] INT,
    [trainingProgramId] INT,
    [startDate] DATE,
    [endDate] DATE,
    [status] NVARCHAR(20) NOT NULL,
    [remarks] NVARCHAR(500),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OjtAssignment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OjtAssignment_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[OjtAssignment])
    EXEC('INSERT INTO [dbo].[_prisma_new_OjtAssignment] ([companyId],[competencyId],[createdAt],[deletedAt],[employeeId],[endDate],[id],[isActive],[mentorEmployeeId],[remarks],[startDate],[status],[trainerId],[trainingProgramId],[updatedAt]) SELECT [companyId],[competencyId],[createdAt],[deletedAt],[employeeId],[endDate],[id],[isActive],[mentorEmployeeId],[remarks],[startDate],[status],[trainerId],[trainingProgramId],[updatedAt] FROM [dbo].[OjtAssignment] WITH (holdlock tablockx)');
DROP TABLE [dbo].[OjtAssignment];
EXEC SP_RENAME N'dbo._prisma_new_OjtAssignment', N'OjtAssignment';
CREATE NONCLUSTERED INDEX [OjtAssignment_companyId_employeeId_idx] ON [dbo].[OjtAssignment]([companyId], [employeeId]);
DROP INDEX [OnDutyRequest_employeeId_idx] ON [dbo].[OnDutyRequest];
DROP INDEX [OnDutyRequest_status_idx] ON [dbo].[OnDutyRequest];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'OnDutyRequest'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_OnDutyRequest] (
    [id] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [fromDate] DATE NOT NULL,
    [toDate] DATE NOT NULL,
    [location] NVARCHAR(200) NOT NULL,
    [purpose] NVARCHAR(500) NOT NULL,
    [customerProject] NVARCHAR(200),
    [remarks] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL,
    [managerActionByUserId] INT,
    [managerActionAt] DATETIME2,
    [managerRejectionReason] NVARCHAR(500),
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [appliedAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OnDutyRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[OnDutyRequest])
    EXEC('INSERT INTO [dbo].[_prisma_new_OnDutyRequest] ([appliedAt],[approvedAt],[approvedByUserId],[createdAt],[customerProject],[employeeId],[fromDate],[id],[location],[managerActionAt],[managerActionByUserId],[managerRejectionReason],[purpose],[rejectionReason],[remarks],[status],[toDate],[updatedAt]) SELECT [appliedAt],[approvedAt],[approvedByUserId],[createdAt],[customerProject],[employeeId],[fromDate],[id],[location],[managerActionAt],[managerActionByUserId],[managerRejectionReason],[purpose],[rejectionReason],[remarks],[status],[toDate],[updatedAt] FROM [dbo].[OnDutyRequest] WITH (holdlock tablockx)');
DROP TABLE [dbo].[OnDutyRequest];
EXEC SP_RENAME N'dbo._prisma_new_OnDutyRequest', N'OnDutyRequest';
CREATE NONCLUSTERED INDEX [OnDutyRequest_employeeId_idx] ON [dbo].[OnDutyRequest]([employeeId]);
CREATE NONCLUSTERED INDEX [OnDutyRequest_status_idx] ON [dbo].[OnDutyRequest]([status]);
DROP INDEX [QuestionBank_companyId_groupId_idx] ON [dbo].[QuestionBank];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'QuestionBank'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_QuestionBank] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [groupId] INT,
    [question] NVARCHAR(1000) NOT NULL,
    [questionType] NVARCHAR(20),
    [options] NVARCHAR(max),
    [correctAnswer] NVARCHAR(500),
    [maxScore] INT NOT NULL,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [QuestionBank_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [QuestionBank_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[QuestionBank])
    EXEC('INSERT INTO [dbo].[_prisma_new_QuestionBank] ([companyId],[correctAnswer],[createdAt],[deletedAt],[groupId],[id],[isActive],[maxScore],[options],[question],[questionType],[updatedAt]) SELECT [companyId],[correctAnswer],[createdAt],[deletedAt],[groupId],[id],[isActive],[maxScore],[options],[question],[questionType],[updatedAt] FROM [dbo].[QuestionBank] WITH (holdlock tablockx)');
DROP TABLE [dbo].[QuestionBank];
EXEC SP_RENAME N'dbo._prisma_new_QuestionBank', N'QuestionBank';
CREATE NONCLUSTERED INDEX [QuestionBank_companyId_groupId_idx] ON [dbo].[QuestionBank]([companyId], [groupId]);
DROP INDEX [QuestionBankGroup_companyId_idx] ON [dbo].[QuestionBankGroup];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'QuestionBankGroup'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_QuestionBankGroup] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [QuestionBankGroup_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [QuestionBankGroup_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[QuestionBankGroup])
    EXEC('INSERT INTO [dbo].[_prisma_new_QuestionBankGroup] ([companyId],[createdAt],[deletedAt],[description],[id],[isActive],[name],[updatedAt]) SELECT [companyId],[createdAt],[deletedAt],[description],[id],[isActive],[name],[updatedAt] FROM [dbo].[QuestionBankGroup] WITH (holdlock tablockx)');
DROP TABLE [dbo].[QuestionBankGroup];
EXEC SP_RENAME N'dbo._prisma_new_QuestionBankGroup', N'QuestionBankGroup';
CREATE NONCLUSTERED INDEX [QuestionBankGroup_companyId_idx] ON [dbo].[QuestionBankGroup]([companyId]);
DROP INDEX [RecruitmentApplicant_companyId_applicationNo_key] ON [dbo].[RecruitmentApplicant];
DROP INDEX [RecruitmentApplicant_companyId_email_idx] ON [dbo].[RecruitmentApplicant];
DROP INDEX [RecruitmentApplicant_companyId_mobile_idx] ON [dbo].[RecruitmentApplicant];
DROP INDEX [RecruitmentApplicant_companyId_status_idx] ON [dbo].[RecruitmentApplicant];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'RecruitmentApplicant'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_RecruitmentApplicant] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [applicationNo] NVARCHAR(40) NOT NULL,
    [applicantDate] DATE NOT NULL CONSTRAINT [RecruitmentApplicant_applicantDate_df] DEFAULT CURRENT_TIMESTAMP,
    [title] NVARCHAR(10),
    [firstName] NVARCHAR(100) NOT NULL,
    [lastName] NVARCHAR(100) NOT NULL,
    [mobile] NVARCHAR(20) NOT NULL,
    [email] NVARCHAR(100) NOT NULL,
    [dateOfBirth] DATE,
    [aadhaarLast4] NVARCHAR(4),
    [departmentId] INT,
    [designationId] INT,
    [jobPostingId] INT,
    [source] NVARCHAR(100),
    [referenceComments] NVARCHAR(500),
    [expectedSalary] DECIMAL(18,2),
    [noticePeriod] NVARCHAR(50),
    [availableJoinDate] DATE,
    [proposedSalary] DECIMAL(18,2),
    [joiningDate] DATE,
    [offerNo] NVARCHAR(50),
    [status] NVARCHAR(24) NOT NULL,
    [employeeId] INT,
    [recruiterRemarks] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RecruitmentApplicant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [RecruitmentApplicant_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RecruitmentApplicant_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[RecruitmentApplicant])
    EXEC('INSERT INTO [dbo].[_prisma_new_RecruitmentApplicant] ([aadhaarLast4],[applicantDate],[applicationNo],[availableJoinDate],[companyId],[createdAt],[dateOfBirth],[departmentId],[designationId],[email],[employeeId],[expectedSalary],[firstName],[id],[jobPostingId],[joiningDate],[lastName],[mobile],[noticePeriod],[offerNo],[proposedSalary],[recruiterRemarks],[referenceComments],[source],[status],[title],[updatedAt]) SELECT [aadhaarLast4],[applicantDate],[applicationNo],[availableJoinDate],[companyId],[createdAt],[dateOfBirth],[departmentId],[designationId],[email],[employeeId],[expectedSalary],[firstName],[id],[jobPostingId],[joiningDate],[lastName],[mobile],[noticePeriod],[offerNo],[proposedSalary],[recruiterRemarks],[referenceComments],[source],[status],[title],[updatedAt] FROM [dbo].[RecruitmentApplicant] WITH (holdlock tablockx)');
DROP TABLE [dbo].[RecruitmentApplicant];
EXEC SP_RENAME N'dbo._prisma_new_RecruitmentApplicant', N'RecruitmentApplicant';
CREATE NONCLUSTERED INDEX [RecruitmentApplicant_companyId_applicationNo_idx] ON [dbo].[RecruitmentApplicant]([companyId], [applicationNo]);
CREATE NONCLUSTERED INDEX [RecruitmentApplicant_companyId_email_idx] ON [dbo].[RecruitmentApplicant]([companyId], [email]);
CREATE NONCLUSTERED INDEX [RecruitmentApplicant_companyId_mobile_idx] ON [dbo].[RecruitmentApplicant]([companyId], [mobile]);
CREATE NONCLUSTERED INDEX [RecruitmentApplicant_companyId_status_idx] ON [dbo].[RecruitmentApplicant]([companyId], [status]);
DROP INDEX [SkillLevel_companyId_idx] ON [dbo].[SkillLevel];
ALTER TABLE [dbo].[SkillLevel] DROP CONSTRAINT [SkillLevel_companyId_levelNumber_key];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'SkillLevel'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_SkillLevel] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [levelNumber] INT NOT NULL,
    [name] NVARCHAR(50) NOT NULL,
    [description] NVARCHAR(500),
    [color] NVARCHAR(7),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SkillLevel_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SkillLevel_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SkillLevel_companyId_key] UNIQUE NONCLUSTERED ([companyId]),
    CONSTRAINT [SkillLevel_levelNumber_key] UNIQUE NONCLUSTERED ([levelNumber])
);
IF EXISTS(SELECT * FROM [dbo].[SkillLevel])
    EXEC('INSERT INTO [dbo].[_prisma_new_SkillLevel] ([color],[companyId],[createdAt],[deletedAt],[description],[id],[isActive],[levelNumber],[name],[updatedAt]) SELECT [color],[companyId],[createdAt],[deletedAt],[description],[id],[isActive],[levelNumber],[name],[updatedAt] FROM [dbo].[SkillLevel] WITH (holdlock tablockx)');
DROP TABLE [dbo].[SkillLevel];
EXEC SP_RENAME N'dbo._prisma_new_SkillLevel', N'SkillLevel';
CREATE NONCLUSTERED INDEX [SkillLevel_companyId_idx] ON [dbo].[SkillLevel]([companyId]);
DROP INDEX [Trainer_companyId_idx] ON [dbo].[Trainer];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'Trainer'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_Trainer] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(100),
    [phone] NVARCHAR(20),
    [isExternal] BIT NOT NULL,
    [vendor] NVARCHAR(100),
    [commercialRate] DECIMAL(18,2),
    [contractDetails] NVARCHAR(500),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Trainer_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Trainer_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[Trainer])
    EXEC('INSERT INTO [dbo].[_prisma_new_Trainer] ([commercialRate],[companyId],[contractDetails],[createdAt],[deletedAt],[email],[id],[isActive],[isExternal],[name],[phone],[updatedAt],[vendor]) SELECT [commercialRate],[companyId],[contractDetails],[createdAt],[deletedAt],[email],[id],[isActive],[isExternal],[name],[phone],[updatedAt],[vendor] FROM [dbo].[Trainer] WITH (holdlock tablockx)');
DROP TABLE [dbo].[Trainer];
EXEC SP_RENAME N'dbo._prisma_new_Trainer', N'Trainer';
CREATE NONCLUSTERED INDEX [Trainer_companyId_idx] ON [dbo].[Trainer]([companyId]);
DROP INDEX [TrainingAttendance_companyId_trainingScheduleId_employeeId_key] ON [dbo].[TrainingAttendance];
DROP INDEX [TrainingAttendance_companyId_trainingScheduleId_idx] ON [dbo].[TrainingAttendance];
DROP INDEX [TrainingAttendance_nominationId_key] ON [dbo].[TrainingAttendance];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingAttendance'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingAttendance] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [trainingScheduleId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL,
    [attendedDuration] DECIMAL(8,2),
    [scheduledDuration] DECIMAL(8,2),
    [attendancePercent] DECIMAL(5,2),
    [markedByUserId] INT,
    [markedAt] DATETIME2,
    [remarks] NVARCHAR(500),
    [nominationId] INT,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingAttendance_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingAttendance_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingAttendance])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingAttendance] ([attendancePercent],[attendedDuration],[companyId],[createdAt],[deletedAt],[employeeId],[id],[isActive],[markedAt],[markedByUserId],[nominationId],[remarks],[scheduledDuration],[status],[trainingScheduleId],[updatedAt]) SELECT [attendancePercent],[attendedDuration],[companyId],[createdAt],[deletedAt],[employeeId],[id],[isActive],[markedAt],[markedByUserId],[nominationId],[remarks],[scheduledDuration],[status],[trainingScheduleId],[updatedAt] FROM [dbo].[TrainingAttendance] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingAttendance];
EXEC SP_RENAME N'dbo._prisma_new_TrainingAttendance', N'TrainingAttendance';
CREATE NONCLUSTERED INDEX [TrainingAttendance_companyId_trainingScheduleId_employeeId_idx] ON [dbo].[TrainingAttendance]([companyId], [trainingScheduleId], [employeeId]);
CREATE NONCLUSTERED INDEX [TrainingAttendance_companyId_trainingScheduleId_idx] ON [dbo].[TrainingAttendance]([companyId], [trainingScheduleId]);
CREATE NONCLUSTERED INDEX [TrainingAttendance_nominationId_idx] ON [dbo].[TrainingAttendance]([nominationId]);
DROP INDEX [TrainingBudget_companyId_year_departmentId_key] ON [dbo].[TrainingBudget];
DROP INDEX [TrainingBudget_companyId_year_idx] ON [dbo].[TrainingBudget];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingBudget'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingBudget] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [year] NVARCHAR(9) NOT NULL,
    [departmentId] INT,
    [allocatedAmount] DECIMAL(18,2) NOT NULL,
    [utilizedAmount] DECIMAL(18,2) NOT NULL,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingBudget_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingBudget_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingBudget])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingBudget] ([allocatedAmount],[companyId],[createdAt],[deletedAt],[departmentId],[id],[isActive],[updatedAt],[utilizedAmount],[year]) SELECT [allocatedAmount],[companyId],[createdAt],[deletedAt],[departmentId],[id],[isActive],[updatedAt],[utilizedAmount],[year] FROM [dbo].[TrainingBudget] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingBudget];
EXEC SP_RENAME N'dbo._prisma_new_TrainingBudget', N'TrainingBudget';
CREATE NONCLUSTERED INDEX [TrainingBudget_companyId_year_departmentId_idx] ON [dbo].[TrainingBudget]([companyId], [year], [departmentId]);
CREATE NONCLUSTERED INDEX [TrainingBudget_companyId_year_idx] ON [dbo].[TrainingBudget]([companyId], [year]);
DROP INDEX [TrainingCertificate_companyId_certificateNumber_key] ON [dbo].[TrainingCertificate];
DROP INDEX [TrainingCertificate_companyId_employeeId_idx] ON [dbo].[TrainingCertificate];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingCertificate'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingCertificate] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [trainingScheduleId] INT,
    [trainingProgramId] INT,
    [certificateNumber] NVARCHAR(50) NOT NULL,
    [issueDate] DATE,
    [expiryDate] DATE,
    [filePath] NVARCHAR(500),
    [issuedByUserId] INT,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingCertificate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingCertificate_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingCertificate])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingCertificate] ([certificateNumber],[companyId],[createdAt],[deletedAt],[employeeId],[expiryDate],[filePath],[id],[isActive],[issueDate],[issuedByUserId],[trainingProgramId],[trainingScheduleId],[updatedAt]) SELECT [certificateNumber],[companyId],[createdAt],[deletedAt],[employeeId],[expiryDate],[filePath],[id],[isActive],[issueDate],[issuedByUserId],[trainingProgramId],[trainingScheduleId],[updatedAt] FROM [dbo].[TrainingCertificate] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingCertificate];
EXEC SP_RENAME N'dbo._prisma_new_TrainingCertificate', N'TrainingCertificate';
CREATE NONCLUSTERED INDEX [TrainingCertificate_companyId_certificateNumber_idx] ON [dbo].[TrainingCertificate]([companyId], [certificateNumber]);
CREATE NONCLUSTERED INDEX [TrainingCertificate_companyId_employeeId_idx] ON [dbo].[TrainingCertificate]([companyId], [employeeId]);
DROP INDEX [TrainingChecklist_companyId_idx] ON [dbo].[TrainingChecklist];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingChecklist'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingChecklist] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [checklistType] NVARCHAR(30) NOT NULL,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingChecklist_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingChecklist_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingChecklist])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingChecklist] ([checklistType],[companyId],[createdAt],[deletedAt],[id],[isActive],[name],[updatedAt]) SELECT [checklistType],[companyId],[createdAt],[deletedAt],[id],[isActive],[name],[updatedAt] FROM [dbo].[TrainingChecklist] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingChecklist];
EXEC SP_RENAME N'dbo._prisma_new_TrainingChecklist', N'TrainingChecklist';
CREATE NONCLUSTERED INDEX [TrainingChecklist_companyId_idx] ON [dbo].[TrainingChecklist]([companyId]);
DROP INDEX [TrainingChecklistItem_checklistId_idx] ON [dbo].[TrainingChecklistItem];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingChecklistItem'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingChecklistItem] (
    [id] INT NOT NULL,
    [checklistId] INT NOT NULL,
    [label] NVARCHAR(300) NOT NULL,
    [sortOrder] INT NOT NULL,
    [isMandatory] BIT NOT NULL,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingChecklistItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingChecklistItem_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingChecklistItem])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingChecklistItem] ([checklistId],[createdAt],[deletedAt],[id],[isActive],[isMandatory],[label],[sortOrder],[updatedAt]) SELECT [checklistId],[createdAt],[deletedAt],[id],[isActive],[isMandatory],[label],[sortOrder],[updatedAt] FROM [dbo].[TrainingChecklistItem] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingChecklistItem];
EXEC SP_RENAME N'dbo._prisma_new_TrainingChecklistItem', N'TrainingChecklistItem';
CREATE NONCLUSTERED INDEX [TrainingChecklistItem_checklistId_idx] ON [dbo].[TrainingChecklistItem]([checklistId]);
DROP INDEX [TrainingEffectiveness_companyId_employeeId_idx] ON [dbo].[TrainingEffectiveness];
DROP INDEX [TrainingEffectiveness_companyId_trainingScheduleId_employeeId_key] ON [dbo].[TrainingEffectiveness];
DROP INDEX [TrainingEffectiveness_companyId_trainingScheduleId_idx] ON [dbo].[TrainingEffectiveness];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingEffectiveness'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingEffectiveness] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [trainingScheduleId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [preScore] INT,
    [postScore] INT,
    [scoreImprovement] INT,
    [level1Reaction] INT,
    [level2Learning] INT,
    [level3Behavior] INT,
    [level4Results] INT,
    [effectivenessRating] NVARCHAR(20),
    [evaluationDate] DATE,
    [remarks] NVARCHAR(500),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingEffectiveness_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingEffectiveness_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingEffectiveness])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingEffectiveness] ([companyId],[createdAt],[deletedAt],[effectivenessRating],[employeeId],[evaluationDate],[id],[isActive],[level1Reaction],[level2Learning],[level3Behavior],[level4Results],[postScore],[preScore],[remarks],[scoreImprovement],[trainingScheduleId],[updatedAt]) SELECT [companyId],[createdAt],[deletedAt],[effectivenessRating],[employeeId],[evaluationDate],[id],[isActive],[level1Reaction],[level2Learning],[level3Behavior],[level4Results],[postScore],[preScore],[remarks],[scoreImprovement],[trainingScheduleId],[updatedAt] FROM [dbo].[TrainingEffectiveness] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingEffectiveness];
EXEC SP_RENAME N'dbo._prisma_new_TrainingEffectiveness', N'TrainingEffectiveness';
CREATE NONCLUSTERED INDEX [TrainingEffectiveness_companyId_employeeId_idx] ON [dbo].[TrainingEffectiveness]([companyId], [employeeId]);
CREATE NONCLUSTERED INDEX [TrainingEffectiveness_companyId_trainingScheduleId_employeeId_idx] ON [dbo].[TrainingEffectiveness]([companyId], [trainingScheduleId], [employeeId]);
CREATE NONCLUSTERED INDEX [TrainingEffectiveness_companyId_trainingScheduleId_idx] ON [dbo].[TrainingEffectiveness]([companyId], [trainingScheduleId]);
DROP INDEX [TrainingFeedback_companyId_trainingScheduleId_employeeId_key] ON [dbo].[TrainingFeedback];
DROP INDEX [TrainingFeedback_companyId_trainingScheduleId_idx] ON [dbo].[TrainingFeedback];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingFeedback'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingFeedback] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [trainingScheduleId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [trainerRating] INT,
    [contentRating] INT,
    [venueRating] INT,
    [overallRating] INT,
    [comments] NVARCHAR(1000),
    [submittedAt] DATETIME2 NOT NULL CONSTRAINT [TrainingFeedback_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingFeedback_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingFeedback_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingFeedback])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingFeedback] ([comments],[companyId],[contentRating],[createdAt],[deletedAt],[employeeId],[id],[isActive],[overallRating],[submittedAt],[trainerRating],[trainingScheduleId],[updatedAt],[venueRating]) SELECT [comments],[companyId],[contentRating],[createdAt],[deletedAt],[employeeId],[id],[isActive],[overallRating],[submittedAt],[trainerRating],[trainingScheduleId],[updatedAt],[venueRating] FROM [dbo].[TrainingFeedback] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingFeedback];
EXEC SP_RENAME N'dbo._prisma_new_TrainingFeedback', N'TrainingFeedback';
CREATE NONCLUSTERED INDEX [TrainingFeedback_companyId_trainingScheduleId_employeeId_idx] ON [dbo].[TrainingFeedback]([companyId], [trainingScheduleId], [employeeId]);
CREATE NONCLUSTERED INDEX [TrainingFeedback_companyId_trainingScheduleId_idx] ON [dbo].[TrainingFeedback]([companyId], [trainingScheduleId]);
DROP INDEX [TrainingHistory_companyId_employeeId_idx] ON [dbo].[TrainingHistory];
DROP INDEX [TrainingHistory_companyId_trainingScheduleId_idx] ON [dbo].[TrainingHistory];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingHistory'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingHistory] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [trainingScheduleId] INT,
    [trainingProgramId] INT,
    [programName] NVARCHAR(200) NOT NULL,
    [competencyId] INT,
    [scheduledDate] DATE,
    [method] NVARCHAR(50),
    [attendanceStatus] NVARCHAR(20),
    [attendancePercent] DECIMAL(5,2),
    [score] DECIMAL(8,2),
    [result] NVARCHAR(20),
    [certificateNumber] NVARCHAR(50),
    [certifiedDate] DATE,
    [trainerId] INT,
    [venueId] INT,
    [status] NVARCHAR(20) NOT NULL,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingHistory])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingHistory] ([attendancePercent],[attendanceStatus],[certificateNumber],[certifiedDate],[companyId],[competencyId],[createdAt],[deletedAt],[employeeId],[id],[isActive],[method],[programName],[result],[scheduledDate],[score],[status],[trainerId],[trainingProgramId],[trainingScheduleId],[updatedAt],[venueId]) SELECT [attendancePercent],[attendanceStatus],[certificateNumber],[certifiedDate],[companyId],[competencyId],[createdAt],[deletedAt],[employeeId],[id],[isActive],[method],[programName],[result],[scheduledDate],[score],[status],[trainerId],[trainingProgramId],[trainingScheduleId],[updatedAt],[venueId] FROM [dbo].[TrainingHistory] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingHistory];
EXEC SP_RENAME N'dbo._prisma_new_TrainingHistory', N'TrainingHistory';
CREATE NONCLUSTERED INDEX [TrainingHistory_companyId_employeeId_idx] ON [dbo].[TrainingHistory]([companyId], [employeeId]);
CREATE NONCLUSTERED INDEX [TrainingHistory_companyId_trainingScheduleId_idx] ON [dbo].[TrainingHistory]([companyId], [trainingScheduleId]);
DROP INDEX [TrainingNeedRequest_companyId_employeeId_idx] ON [dbo].[TrainingNeedRequest];
DROP INDEX [TrainingNeedRequest_companyId_status_idx] ON [dbo].[TrainingNeedRequest];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingNeedRequest'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingNeedRequest] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [competencyId] INT,
    [trainingProgramId] INT,
    [source] NVARCHAR(30),
    [reason] NVARCHAR(500),
    [priority] NVARCHAR(20),
    [status] NVARCHAR(20) NOT NULL,
    [currentStageOrder] INT NOT NULL,
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [rejectedByUserId] INT,
    [rejectedAt] DATETIME2,
    [tnaReference] NVARCHAR(100),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingNeedRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingNeedRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingNeedRequest])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingNeedRequest] ([approvedAt],[approvedByUserId],[companyId],[competencyId],[createdAt],[currentStageOrder],[deletedAt],[employeeId],[id],[isActive],[priority],[reason],[rejectedAt],[rejectedByUserId],[rejectionReason],[source],[status],[tnaReference],[trainingProgramId],[updatedAt]) SELECT [approvedAt],[approvedByUserId],[companyId],[competencyId],[createdAt],[currentStageOrder],[deletedAt],[employeeId],[id],[isActive],[priority],[reason],[rejectedAt],[rejectedByUserId],[rejectionReason],[source],[status],[tnaReference],[trainingProgramId],[updatedAt] FROM [dbo].[TrainingNeedRequest] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingNeedRequest];
EXEC SP_RENAME N'dbo._prisma_new_TrainingNeedRequest', N'TrainingNeedRequest';
CREATE NONCLUSTERED INDEX [TrainingNeedRequest_companyId_employeeId_idx] ON [dbo].[TrainingNeedRequest]([companyId], [employeeId]);
CREATE NONCLUSTERED INDEX [TrainingNeedRequest_companyId_status_idx] ON [dbo].[TrainingNeedRequest]([companyId], [status]);
DROP INDEX [TrainingNomination_companyId_employeeId_idx] ON [dbo].[TrainingNomination];
DROP INDEX [TrainingNomination_companyId_status_idx] ON [dbo].[TrainingNomination];
DROP INDEX [TrainingNomination_companyId_trainingScheduleId_employeeId_key] ON [dbo].[TrainingNomination];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingNomination'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingNomination] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [trainingScheduleId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [reason] NVARCHAR(200),
    [priority] NVARCHAR(20),
    [nominationDate] DATETIME2 NOT NULL CONSTRAINT [TrainingNomination_nominationDate_df] DEFAULT CURRENT_TIMESTAMP,
    [status] NVARCHAR(20) NOT NULL,
    [currentStageOrder] INT NOT NULL,
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [rejectedByUserId] INT,
    [rejectedAt] DATETIME2,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingNomination_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingNomination_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingNomination])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingNomination] ([approvedAt],[approvedByUserId],[companyId],[createdAt],[currentStageOrder],[deletedAt],[employeeId],[id],[isActive],[nominationDate],[priority],[reason],[rejectedAt],[rejectedByUserId],[rejectionReason],[status],[trainingScheduleId],[updatedAt]) SELECT [approvedAt],[approvedByUserId],[companyId],[createdAt],[currentStageOrder],[deletedAt],[employeeId],[id],[isActive],[nominationDate],[priority],[reason],[rejectedAt],[rejectedByUserId],[rejectionReason],[status],[trainingScheduleId],[updatedAt] FROM [dbo].[TrainingNomination] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingNomination];
EXEC SP_RENAME N'dbo._prisma_new_TrainingNomination', N'TrainingNomination';
CREATE NONCLUSTERED INDEX [TrainingNomination_companyId_employeeId_idx] ON [dbo].[TrainingNomination]([companyId], [employeeId]);
CREATE NONCLUSTERED INDEX [TrainingNomination_companyId_status_idx] ON [dbo].[TrainingNomination]([companyId], [status]);
CREATE NONCLUSTERED INDEX [TrainingNomination_companyId_trainingScheduleId_employeeId_idx] ON [dbo].[TrainingNomination]([companyId], [trainingScheduleId], [employeeId]);
DROP INDEX [TrainingPlan_companyId_departmentId_idx] ON [dbo].[TrainingPlan];
DROP INDEX [TrainingPlan_companyId_year_idx] ON [dbo].[TrainingPlan];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingPlan'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingPlan] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [year] NVARCHAR(9) NOT NULL,
    [departmentId] INT,
    [title] NVARCHAR(200),
    [status] NVARCHAR(20) NOT NULL,
    [totalEstimatedCost] DECIMAL(18,2),
    [totalApprovedBudget] DECIMAL(18,2),
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingPlan_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingPlan])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingPlan] ([approvedAt],[approvedByUserId],[companyId],[createdAt],[deletedAt],[departmentId],[id],[isActive],[status],[title],[totalApprovedBudget],[totalEstimatedCost],[updatedAt],[year]) SELECT [approvedAt],[approvedByUserId],[companyId],[createdAt],[deletedAt],[departmentId],[id],[isActive],[status],[title],[totalApprovedBudget],[totalEstimatedCost],[updatedAt],[year] FROM [dbo].[TrainingPlan] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingPlan];
EXEC SP_RENAME N'dbo._prisma_new_TrainingPlan', N'TrainingPlan';
CREATE NONCLUSTERED INDEX [TrainingPlan_companyId_departmentId_idx] ON [dbo].[TrainingPlan]([companyId], [departmentId]);
CREATE NONCLUSTERED INDEX [TrainingPlan_companyId_year_idx] ON [dbo].[TrainingPlan]([companyId], [year]);
DROP INDEX [TrainingPlanLine_companyId_plannedMonth_idx] ON [dbo].[TrainingPlanLine];
DROP INDEX [TrainingPlanLine_companyId_trainingPlanId_idx] ON [dbo].[TrainingPlanLine];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingPlanLine'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingPlanLine] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [trainingPlanId] INT NOT NULL,
    [competencyId] INT,
    [plannedMonth] INT NOT NULL,
    [trainingProgramId] INT NOT NULL,
    [trainerId] INT,
    [trainingMethod] NVARCHAR(50),
    [duration] DECIMAL(8,2),
    [durationUnit] NVARCHAR(20),
    [participantCount] INT,
    [targetEmployeeIds] NVARCHAR(max),
    [estimatedCost] DECIMAL(18,2),
    [approvedAmount] DECIMAL(18,2),
    [priority] NVARCHAR(20),
    [isMandatory] BIT NOT NULL,
    [expectedOutcome] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL,
    [tnaReference] NVARCHAR(100),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingPlanLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingPlanLine_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingPlanLine])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingPlanLine] ([approvedAmount],[companyId],[competencyId],[createdAt],[deletedAt],[duration],[durationUnit],[estimatedCost],[expectedOutcome],[id],[isActive],[isMandatory],[participantCount],[plannedMonth],[priority],[status],[targetEmployeeIds],[tnaReference],[trainerId],[trainingMethod],[trainingPlanId],[trainingProgramId],[updatedAt]) SELECT [approvedAmount],[companyId],[competencyId],[createdAt],[deletedAt],[duration],[durationUnit],[estimatedCost],[expectedOutcome],[id],[isActive],[isMandatory],[participantCount],[plannedMonth],[priority],[status],[targetEmployeeIds],[tnaReference],[trainerId],[trainingMethod],[trainingPlanId],[trainingProgramId],[updatedAt] FROM [dbo].[TrainingPlanLine] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingPlanLine];
EXEC SP_RENAME N'dbo._prisma_new_TrainingPlanLine', N'TrainingPlanLine';
CREATE NONCLUSTERED INDEX [TrainingPlanLine_companyId_plannedMonth_idx] ON [dbo].[TrainingPlanLine]([companyId], [plannedMonth]);
CREATE NONCLUSTERED INDEX [TrainingPlanLine_companyId_trainingPlanId_idx] ON [dbo].[TrainingPlanLine]([companyId], [trainingPlanId]);
DROP INDEX [TrainingPolicy_companyId_idx] ON [dbo].[TrainingPolicy];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingPolicy'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingPolicy] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [minAttendancePercent] INT,
    [assessmentRequired] BIT NOT NULL,
    [feedbackRequired] BIT NOT NULL,
    [nominationCutoffDays] INT,
    [externalBudgetCap] DECIMAL(18,2),
    [mandatoryTrainingGraceDays] INT,
    [effectiveFrom] DATE,
    [effectiveTo] DATE,
    [remarks] NVARCHAR(500),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingPolicy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingPolicy_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingPolicy])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingPolicy] ([assessmentRequired],[companyId],[createdAt],[deletedAt],[effectiveFrom],[effectiveTo],[externalBudgetCap],[feedbackRequired],[id],[isActive],[mandatoryTrainingGraceDays],[minAttendancePercent],[name],[nominationCutoffDays],[remarks],[updatedAt]) SELECT [assessmentRequired],[companyId],[createdAt],[deletedAt],[effectiveFrom],[effectiveTo],[externalBudgetCap],[feedbackRequired],[id],[isActive],[mandatoryTrainingGraceDays],[minAttendancePercent],[name],[nominationCutoffDays],[remarks],[updatedAt] FROM [dbo].[TrainingPolicy] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingPolicy];
EXEC SP_RENAME N'dbo._prisma_new_TrainingPolicy', N'TrainingPolicy';
CREATE NONCLUSTERED INDEX [TrainingPolicy_companyId_idx] ON [dbo].[TrainingPolicy]([companyId]);
DROP INDEX [TrainingProgram_companyId_category_idx] ON [dbo].[TrainingProgram];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingProgram'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingProgram] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20),
    [name] NVARCHAR(100) NOT NULL,
    [category] NVARCHAR(50),
    [type] NVARCHAR(50),
    [objective] NVARCHAR(500),
    [learningOutcome] NVARCHAR(500),
    [targetAudience] NVARCHAR(200),
    [method] NVARCHAR(50),
    [duration] DECIMAL(8,2),
    [durationUnit] NVARCHAR(20),
    [assessmentRequired] BIT NOT NULL,
    [certificationRequired] BIT NOT NULL,
    [validityMonths] INT,
    [refresherFrequency] NVARCHAR(50),
    [estimatedCost] DECIMAL(18,2),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingProgram_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingProgram_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingProgram])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingProgram] ([assessmentRequired],[category],[certificationRequired],[code],[companyId],[createdAt],[deletedAt],[duration],[durationUnit],[estimatedCost],[id],[isActive],[learningOutcome],[method],[name],[objective],[refresherFrequency],[targetAudience],[type],[updatedAt],[validityMonths]) SELECT [assessmentRequired],[category],[certificationRequired],[code],[companyId],[createdAt],[deletedAt],[duration],[durationUnit],[estimatedCost],[id],[isActive],[learningOutcome],[method],[name],[objective],[refresherFrequency],[targetAudience],[type],[updatedAt],[validityMonths] FROM [dbo].[TrainingProgram] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingProgram];
EXEC SP_RENAME N'dbo._prisma_new_TrainingProgram', N'TrainingProgram';
CREATE NONCLUSTERED INDEX [TrainingProgram_companyId_category_idx] ON [dbo].[TrainingProgram]([companyId], [category]);
DROP INDEX [TrainingSchedule_companyId_scheduledDate_idx] ON [dbo].[TrainingSchedule];
DROP INDEX [TrainingSchedule_companyId_status_idx] ON [dbo].[TrainingSchedule];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingSchedule'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingSchedule] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [trainingPlanLineId] INT,
    [trainingProgramId] INT NOT NULL,
    [title] NVARCHAR(200),
    [scheduledDate] DATE,
    [startTime] NVARCHAR(8),
    [endTime] NVARCHAR(8),
    [duration] DECIMAL(8,2),
    [durationUnit] NVARCHAR(20),
    [method] NVARCHAR(50),
    [venueId] INT,
    [meetingLink] NVARCHAR(500),
    [trainerId] INT,
    [coTrainerId] INT,
    [coordinator] NVARCHAR(100),
    [maxParticipants] INT,
    [targetDepartmentId] INT,
    [targetEmployeeIds] NVARCHAR(max),
    [status] NVARCHAR(20) NOT NULL,
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingSchedule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingSchedule_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingSchedule])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingSchedule] ([coTrainerId],[companyId],[coordinator],[createdAt],[deletedAt],[duration],[durationUnit],[endTime],[id],[isActive],[maxParticipants],[meetingLink],[method],[scheduledDate],[startTime],[status],[targetDepartmentId],[targetEmployeeIds],[title],[trainerId],[trainingPlanLineId],[trainingProgramId],[updatedAt],[venueId]) SELECT [coTrainerId],[companyId],[coordinator],[createdAt],[deletedAt],[duration],[durationUnit],[endTime],[id],[isActive],[maxParticipants],[meetingLink],[method],[scheduledDate],[startTime],[status],[targetDepartmentId],[targetEmployeeIds],[title],[trainerId],[trainingPlanLineId],[trainingProgramId],[updatedAt],[venueId] FROM [dbo].[TrainingSchedule] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingSchedule];
EXEC SP_RENAME N'dbo._prisma_new_TrainingSchedule', N'TrainingSchedule';
CREATE NONCLUSTERED INDEX [TrainingSchedule_companyId_scheduledDate_idx] ON [dbo].[TrainingSchedule]([companyId], [scheduledDate]);
CREATE NONCLUSTERED INDEX [TrainingSchedule_companyId_status_idx] ON [dbo].[TrainingSchedule]([companyId], [status]);
DROP INDEX [TrainingVenue_companyId_idx] ON [dbo].[TrainingVenue];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'TrainingVenue'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_TrainingVenue] (
    [id] INT NOT NULL,
    [companyId] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [capacity] INT,
    [location] NVARCHAR(200),
    [equipment] NVARCHAR(500),
    [isActive] BIT NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingVenue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingVenue_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[TrainingVenue])
    EXEC('INSERT INTO [dbo].[_prisma_new_TrainingVenue] ([capacity],[companyId],[createdAt],[deletedAt],[equipment],[id],[isActive],[location],[name],[updatedAt]) SELECT [capacity],[companyId],[createdAt],[deletedAt],[equipment],[id],[isActive],[location],[name],[updatedAt] FROM [dbo].[TrainingVenue] WITH (holdlock tablockx)');
DROP TABLE [dbo].[TrainingVenue];
EXEC SP_RENAME N'dbo._prisma_new_TrainingVenue', N'TrainingVenue';
CREATE NONCLUSTERED INDEX [TrainingVenue_companyId_idx] ON [dbo].[TrainingVenue]([companyId]);
DROP INDEX [WfhRequest_employeeId_idx] ON [dbo].[WfhRequest];
DROP INDEX [WfhRequest_status_idx] ON [dbo].[WfhRequest];
DECLARE @SQL NVARCHAR(MAX) = N''
SELECT @SQL += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(PARENT_OBJECT_ID))
    + '.'
    + QUOTENAME(OBJECT_NAME(PARENT_OBJECT_ID))
    + ' DROP CONSTRAINT '
    + OBJECT_NAME(OBJECT_ID) + ';'
FROM SYS.OBJECTS
WHERE TYPE_DESC LIKE '%CONSTRAINT'
    AND OBJECT_NAME(PARENT_OBJECT_ID) = 'WfhRequest'
    AND SCHEMA_NAME(SCHEMA_ID) = 'dbo'
EXEC sp_executesql @SQL
;
CREATE TABLE [dbo].[_prisma_new_WfhRequest] (
    [id] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [fromDate] DATE NOT NULL,
    [toDate] DATE NOT NULL,
    [reason] NVARCHAR(500) NOT NULL,
    [remarks] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL,
    [managerActionByUserId] INT,
    [managerActionAt] DATETIME2,
    [managerRejectionReason] NVARCHAR(500),
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(500),
    [appliedAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WfhRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);
IF EXISTS(SELECT * FROM [dbo].[WfhRequest])
    EXEC('INSERT INTO [dbo].[_prisma_new_WfhRequest] ([appliedAt],[approvedAt],[approvedByUserId],[createdAt],[employeeId],[fromDate],[id],[managerActionAt],[managerActionByUserId],[managerRejectionReason],[reason],[rejectionReason],[remarks],[status],[toDate],[updatedAt]) SELECT [appliedAt],[approvedAt],[approvedByUserId],[createdAt],[employeeId],[fromDate],[id],[managerActionAt],[managerActionByUserId],[managerRejectionReason],[reason],[rejectionReason],[remarks],[status],[toDate],[updatedAt] FROM [dbo].[WfhRequest] WITH (holdlock tablockx)');
DROP TABLE [dbo].[WfhRequest];
EXEC SP_RENAME N'dbo._prisma_new_WfhRequest', N'WfhRequest';
CREATE NONCLUSTERED INDEX [WfhRequest_employeeId_idx] ON [dbo].[WfhRequest]([employeeId]);
CREATE NONCLUSTERED INDEX [WfhRequest_status_idx] ON [dbo].[WfhRequest]([status]);
COMMIT;

-- CreateIndex
CREATE NONCLUSTERED INDEX [FnFSettlement_companyId_status_idx] ON [dbo].[FnFSettlement]([companyId], [status]);

-- CreateIndex
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_userId_key] UNIQUE NONCLUSTERED ([userId]);

-- CreateIndex
ALTER TABLE [dbo].[SalaryRevisionRequest] ADD CONSTRAINT [SalaryRevisionRequest_appliedRevisionId_key] UNIQUE NONCLUSTERED ([appliedRevisionId]);

-- CreateIndex
ALTER TABLE [dbo].[SubDepartment] ADD CONSTRAINT [SubDepartment_departmentId_code_key] UNIQUE NONCLUSTERED ([departmentId], [code]);

-- CreateIndex
ALTER TABLE [dbo].[Unit] ADD CONSTRAINT [Unit_companyId_code_key] UNIQUE NONCLUSTERED ([companyId], [code]);

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_CanteenToken_Employee', 'CanteenToken_employeeId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_CompOffBalance_Employee', 'CompOffBalance_employeeId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_CompOffTransaction_Employee', 'CompOffTransaction_employeeId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_DoubleMachineEntry_Employee', 'DoubleMachineEntry_employeeId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_FnFSettlement_Employee', 'FnFSettlement_employeeId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_FnFSettlement_ExitInterview', 'FnFSettlement_exitInterviewId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_GateNumberRegister_Company', 'GateNumberRegister_companyId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_GNRLineItem_GateNumberRegister', 'GNRLineItem_gnrId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_Loan_Employee', 'Loan_employeeId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_ManualArrear_Company', 'ManualArrear_companyId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_ManualArrear_Employee', 'ManualArrear_employeeId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_ManualArrear_PayrollRun', 'ManualArrear_appliedPayrollRunId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_PetrolAllowanceEntry_Employee', 'PetrolAllowanceEntry_employeeId_fkey', 'OBJECT';

-- RenameForeignKey
EXEC sp_rename 'dbo.FK_TdsInvestmentDeclaration_Employee', 'TdsInvestmentDeclaration_employeeId_fkey', 'OBJECT';

-- AddForeignKey
ALTER TABLE [dbo].[HolidayMaster] ADD CONSTRAINT [HolidayMaster_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[DepartmentWeeklyOff] ADD CONSTRAINT [DepartmentWeeklyOff_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[DepartmentWeeklyOff] ADD CONSTRAINT [DepartmentWeeklyOff_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LeaveTypeMaster] ADD CONSTRAINT [LeaveTypeMaster_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[YearlyLeaveCalendar] ADD CONSTRAINT [YearlyLeaveCalendar_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[YearlyLeaveCalendar] ADD CONSTRAINT [YearlyLeaveCalendar_leaveTypeMasterId_fkey] FOREIGN KEY ([leaveTypeMasterId]) REFERENCES [dbo].[LeaveTypeMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_secondReportingManagerId_fkey] FOREIGN KEY ([secondReportingManagerId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ShiftAssignmentOverride] ADD CONSTRAINT [ShiftAssignmentOverride_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ShiftAssignmentOverride] ADD CONSTRAINT [ShiftAssignmentOverride_shiftMasterId_fkey] FOREIGN KEY ([shiftMasterId]) REFERENCES [dbo].[ShiftMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalChainConfig] ADD CONSTRAINT [ApprovalChainConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ShiftChangeRequest] ADD CONSTRAINT [ShiftChangeRequest_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ShiftChangeRequest] ADD CONSTRAINT [ShiftChangeRequest_currentShiftMasterId_fkey] FOREIGN KEY ([currentShiftMasterId]) REFERENCES [dbo].[ShiftMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ShiftChangeRequest] ADD CONSTRAINT [ShiftChangeRequest_requestedShiftMasterId_fkey] FOREIGN KEY ([requestedShiftMasterId]) REFERENCES [dbo].[ShiftMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ShiftChangeNotification] ADD CONSTRAINT [ShiftChangeNotification_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ShiftChangeNotification] ADD CONSTRAINT [ShiftChangeNotification_oldShiftMasterId_fkey] FOREIGN KEY ([oldShiftMasterId]) REFERENCES [dbo].[ShiftMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ShiftChangeNotification] ADD CONSTRAINT [ShiftChangeNotification_newShiftMasterId_fkey] FOREIGN KEY ([newShiftMasterId]) REFERENCES [dbo].[ShiftMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CompOffRequest] ADD CONSTRAINT [CompOffRequest_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD CONSTRAINT [BenefitRateByEmployeeType_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD CONSTRAINT [BenefitRateByEmployeeType_employeeTypeId_fkey] FOREIGN KEY ([employeeTypeId]) REFERENCES [dbo].[EmployeeType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BenefitRateByEmployeeType] ADD CONSTRAINT [BenefitRateByEmployeeType_salaryComponentId_fkey] FOREIGN KEY ([salaryComponentId]) REFERENCES [dbo].[SalaryComponent]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PmsIncentive] ADD CONSTRAINT [PmsIncentive_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[MispunchCorrection] ADD CONSTRAINT [MispunchCorrection_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PermissionPolicy] ADD CONSTRAINT [PermissionPolicy_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LomConfig] ADD CONSTRAINT [LomConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RoundingConfig] ADD CONSTRAINT [RoundingConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PayrollValidationConfig] ADD CONSTRAINT [PayrollValidationConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PayrollWorkflowConfig] ADD CONSTRAINT [PayrollWorkflowConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PayrollDisplayConfig] ADD CONSTRAINT [PayrollDisplayConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CompOffPolicy] ADD CONSTRAINT [CompOffPolicy_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[OTIncentiveSlab] ADD CONSTRAINT [OTIncentiveSlab_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AttendanceBonusConfig] ADD CONSTRAINT [AttendanceBonusConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LwfRate] ADD CONSTRAINT [LwfRate_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[StatePtConfig] ADD CONSTRAINT [StatePtConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TdsRegimeConfig] ADD CONSTRAINT [TdsRegimeConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HealthInsuranceConfig] ADD CONSTRAINT [HealthInsuranceConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PermissionRequest] ADD CONSTRAINT [PermissionRequest_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[VisitorGatePass] ADD CONSTRAINT [VisitorGatePass_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VisitorGatePass] ADD CONSTRAINT [VisitorGatePass_personToMeetId_fkey] FOREIGN KEY ([personToMeetId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LeaveEncashmentConfig] ADD CONSTRAINT [LeaveEncashmentConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[FullAndFinalConfig] ADD CONSTRAINT [FullAndFinalConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[BankFileTemplate] ADD CONSTRAINT [BankFileTemplate_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TdsInvestmentDeclaration] ADD CONSTRAINT [TdsInvestmentDeclaration_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TdsInvestmentProof] ADD CONSTRAINT [TdsInvestmentProof_declarationId_fkey] FOREIGN KEY ([declarationId]) REFERENCES [dbo].[TdsInvestmentDeclaration]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Loan] ADD CONSTRAINT [Loan_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Loan] ADD CONSTRAINT [Loan_loanTypeId_fkey] FOREIGN KEY ([loanTypeId]) REFERENCES [dbo].[LoanType]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LoanInstallment] ADD CONSTRAINT [LoanInstallment_loanId_fkey] FOREIGN KEY ([loanId]) REFERENCES [dbo].[Loan]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[FnFSettlement] ADD CONSTRAINT [FnFSettlement_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[IncentivePolicy] ADD CONSTRAINT [IncentivePolicy_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AllowanceConfig] ADD CONSTRAINT [AllowanceConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AttendanceColorConfig] ADD CONSTRAINT [AttendanceColorConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LicDeductionConfig] ADD CONSTRAINT [LicDeductionConfig_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AttendancePolicy] ADD CONSTRAINT [AttendancePolicy_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JobPosting] ADD CONSTRAINT [JobPosting_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[Site]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewLevel] ADD CONSTRAINT [InterviewLevel_interviewTypeId_fkey] FOREIGN KEY ([interviewTypeId]) REFERENCES [dbo].[InterviewType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewCriteria] ADD CONSTRAINT [InterviewCriteria_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewCriteria] ADD CONSTRAINT [InterviewCriteria_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewCriteria] ADD CONSTRAINT [InterviewCriteria_interviewTypeId_fkey] FOREIGN KEY ([interviewTypeId]) REFERENCES [dbo].[InterviewType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewCriteria] ADD CONSTRAINT [InterviewCriteria_interviewLevelId_fkey] FOREIGN KEY ([interviewLevelId]) REFERENCES [dbo].[InterviewLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewScoreConfig] ADD CONSTRAINT [InterviewScoreConfig_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewScoreConfig] ADD CONSTRAINT [InterviewScoreConfig_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewScoreConfig] ADD CONSTRAINT [InterviewScoreConfig_interviewLevelId_fkey] FOREIGN KEY ([interviewLevelId]) REFERENCES [dbo].[InterviewLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewScoreConfig] ADD CONSTRAINT [InterviewScoreConfig_interviewTypeId_fkey] FOREIGN KEY ([interviewTypeId]) REFERENCES [dbo].[InterviewType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewScoreConfig] ADD CONSTRAINT [InterviewScoreConfig_criteriaId_fkey] FOREIGN KEY ([criteriaId]) REFERENCES [dbo].[InterviewCriteria]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewPanel] ADD CONSTRAINT [InterviewPanel_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewPanel] ADD CONSTRAINT [InterviewPanel_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewPanel] ADD CONSTRAINT [InterviewPanel_interviewLevelId_fkey] FOREIGN KEY ([interviewLevelId]) REFERENCES [dbo].[InterviewLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewPanel] ADD CONSTRAINT [InterviewPanel_interviewTypeId_fkey] FOREIGN KEY ([interviewTypeId]) REFERENCES [dbo].[InterviewType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewPanel] ADD CONSTRAINT [InterviewPanel_eligibleInterviewerId_fkey] FOREIGN KEY ([eligibleInterviewerId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewProcess] ADD CONSTRAINT [InterviewProcess_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewProcess] ADD CONSTRAINT [InterviewProcess_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewProcessLevel] ADD CONSTRAINT [InterviewProcessLevel_processId_fkey] FOREIGN KEY ([processId]) REFERENCES [dbo].[InterviewProcess]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewProcessLevel] ADD CONSTRAINT [InterviewProcessLevel_interviewLevelId_fkey] FOREIGN KEY ([interviewLevelId]) REFERENCES [dbo].[InterviewLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewProcessLevel] ADD CONSTRAINT [InterviewProcessLevel_interviewTypeId_fkey] FOREIGN KEY ([interviewTypeId]) REFERENCES [dbo].[InterviewType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DocumentType] ADD CONSTRAINT [DocumentType_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DocumentType] ADD CONSTRAINT [DocumentType_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmailTemplate] ADD CONSTRAINT [EmailTemplate_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmailTemplate] ADD CONSTRAINT [EmailTemplate_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfferTemplate] ADD CONSTRAINT [OfferTemplate_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfferTemplate] ADD CONSTRAINT [OfferTemplate_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AppointmentTemplate] ADD CONSTRAINT [AppointmentTemplate_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AppointmentTemplate] ADD CONSTRAINT [AppointmentTemplate_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DesignationLevel] ADD CONSTRAINT [DesignationLevel_defaultApproverId_fkey] FOREIGN KEY ([defaultApproverId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DesignationLevelMapping] ADD CONSTRAINT [DesignationLevelMapping_designationLevelId_fkey] FOREIGN KEY ([designationLevelId]) REFERENCES [dbo].[DesignationLevel]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[DesignationLevelMapping] ADD CONSTRAINT [DesignationLevelMapping_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RecruitmentApprovalMatrix] ADD CONSTRAINT [RecruitmentApprovalMatrix_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RecruitmentApprovalMatrix] ADD CONSTRAINT [RecruitmentApprovalMatrix_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JoiningApprovalMatrix] ADD CONSTRAINT [JoiningApprovalMatrix_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JoiningApprovalMatrix] ADD CONSTRAINT [JoiningApprovalMatrix_designationLevelId_fkey] FOREIGN KEY ([designationLevelId]) REFERENCES [dbo].[DesignationLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JoiningApprovalMatrix] ADD CONSTRAINT [JoiningApprovalMatrix_approverId_fkey] FOREIGN KEY ([approverId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateOtherDocument] ADD CONSTRAINT [CandidateOtherDocument_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateOtherDocument] ADD CONSTRAINT [CandidateOtherDocument_otherDocTypeId_fkey] FOREIGN KEY ([otherDocTypeId]) REFERENCES [dbo].[OtherJoiningDocType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Candidate] ADD CONSTRAINT [Candidate_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Candidate] ADD CONSTRAINT [Candidate_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Candidate] ADD CONSTRAINT [Candidate_jobPostingId_fkey] FOREIGN KEY ([jobPostingId]) REFERENCES [dbo].[JobPosting]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Candidate] ADD CONSTRAINT [Candidate_sourceChannelId_fkey] FOREIGN KEY ([sourceChannelId]) REFERENCES [dbo].[SourcingChannel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Candidate] ADD CONSTRAINT [Candidate_currentStatusId_fkey] FOREIGN KEY ([currentStatusId]) REFERENCES [dbo].[RecruitmentStatus]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Candidate] ADD CONSTRAINT [Candidate_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Candidate] ADD CONSTRAINT [Candidate_convertedEmployeeId_fkey] FOREIGN KEY ([convertedEmployeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateDetail] ADD CONSTRAINT [CandidateDetail_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateDocument] ADD CONSTRAINT [CandidateDocument_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateDocument] ADD CONSTRAINT [CandidateDocument_documentTypeId_fkey] FOREIGN KEY ([documentTypeId]) REFERENCES [dbo].[DocumentType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateDocument] ADD CONSTRAINT [CandidateDocument_verifiedById_fkey] FOREIGN KEY ([verifiedById]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateActivityLog] ADD CONSTRAINT [CandidateActivityLog_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateActivityLog] ADD CONSTRAINT [CandidateActivityLog_performedById_fkey] FOREIGN KEY ([performedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CallInterview] ADD CONSTRAINT [CallInterview_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CallInterview] ADD CONSTRAINT [CallInterview_recruiterId_fkey] FOREIGN KEY ([recruiterId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewSchedule] ADD CONSTRAINT [InterviewSchedule_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewSchedule] ADD CONSTRAINT [InterviewSchedule_interviewLevelId_fkey] FOREIGN KEY ([interviewLevelId]) REFERENCES [dbo].[InterviewLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewSchedule] ADD CONSTRAINT [InterviewSchedule_interviewTypeId_fkey] FOREIGN KEY ([interviewTypeId]) REFERENCES [dbo].[InterviewType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewSchedule] ADD CONSTRAINT [InterviewSchedule_interviewerId_fkey] FOREIGN KEY ([interviewerId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewEvaluation] ADD CONSTRAINT [InterviewEvaluation_scheduleId_fkey] FOREIGN KEY ([scheduleId]) REFERENCES [dbo].[InterviewSchedule]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewEvaluation] ADD CONSTRAINT [InterviewEvaluation_criteriaId_fkey] FOREIGN KEY ([criteriaId]) REFERENCES [dbo].[InterviewCriteria]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewEvaluation] ADD CONSTRAINT [InterviewEvaluation_submittedById_fkey] FOREIGN KEY ([submittedById]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InterviewEvaluationSummary] ADD CONSTRAINT [InterviewEvaluationSummary_scheduleId_fkey] FOREIGN KEY ([scheduleId]) REFERENCES [dbo].[InterviewSchedule]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateBgv] ADD CONSTRAINT [CandidateBgv_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateBgv] ADD CONSTRAINT [CandidateBgv_bgvStepId_fkey] FOREIGN KEY ([bgvStepId]) REFERENCES [dbo].[BgvStep]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfferLetter] ADD CONSTRAINT [OfferLetter_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[OfferLetter] ADD CONSTRAINT [OfferLetter_offerTemplateId_fkey] FOREIGN KEY ([offerTemplateId]) REFERENCES [dbo].[OfferTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfferLetter] ADD CONSTRAINT [OfferLetter_reportingManagerId_fkey] FOREIGN KEY ([reportingManagerId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfferLetter] ADD CONSTRAINT [OfferLetter_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[Site]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfferLetter] ADD CONSTRAINT [OfferLetter_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AppointmentOrder] ADD CONSTRAINT [AppointmentOrder_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AppointmentOrder] ADD CONSTRAINT [AppointmentOrder_offerLetterId_fkey] FOREIGN KEY ([offerLetterId]) REFERENCES [dbo].[OfferLetter]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AppointmentOrder] ADD CONSTRAINT [AppointmentOrder_appointmentTemplateId_fkey] FOREIGN KEY ([appointmentTemplateId]) REFERENCES [dbo].[AppointmentTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Internship] ADD CONSTRAINT [Internship_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Internship] ADD CONSTRAINT [Internship_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Internship] ADD CONSTRAINT [Internship_mentorId_fkey] FOREIGN KEY ([mentorId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Internship] ADD CONSTRAINT [Internship_policyId_fkey] FOREIGN KEY ([policyId]) REFERENCES [dbo].[InternshipPolicy]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateJoining] ADD CONSTRAINT [CandidateJoining_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateJoining] ADD CONSTRAINT [CandidateJoining_offerLetterId_fkey] FOREIGN KEY ([offerLetterId]) REFERENCES [dbo].[OfferLetter]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateJoining] ADD CONSTRAINT [CandidateJoining_approverId_fkey] FOREIGN KEY ([approverId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateChecklistItem] ADD CONSTRAINT [CandidateChecklistItem_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateChecklistItem] ADD CONSTRAINT [CandidateChecklistItem_checklistMasterId_fkey] FOREIGN KEY ([checklistMasterId]) REFERENCES [dbo].[ChecklistMaster]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CandidateChecklistItem] ADD CONSTRAINT [CandidateChecklistItem_updatedById_fkey] FOREIGN KEY ([updatedById]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JoiningForm] ADD CONSTRAINT [JoiningForm_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JoiningForm] ADD CONSTRAINT [JoiningForm_verifiedById_fkey] FOREIGN KEY ([verifiedById]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JoiningReport] ADD CONSTRAINT [JoiningReport_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[JoiningReport] ADD CONSTRAINT [JoiningReport_locationId_fkey] FOREIGN KEY ([locationId]) REFERENCES [dbo].[Site]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[JoiningReport] ADD CONSTRAINT [JoiningReport_designationId_fkey] FOREIGN KEY ([designationId]) REFERENCES [dbo].[Designation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GratuityNomination] ADD CONSTRAINT [GratuityNomination_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[GratuityNominee] ADD CONSTRAINT [GratuityNominee_nominationId_fkey] FOREIGN KEY ([nominationId]) REFERENCES [dbo].[GratuityNomination]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PfNomination] ADD CONSTRAINT [PfNomination_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PfNominee] ADD CONSTRAINT [PfNominee_nominationId_fkey] FOREIGN KEY ([nominationId]) REFERENCES [dbo].[PfNomination]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EsiApplication] ADD CONSTRAINT [EsiApplication_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[InsuranceForm] ADD CONSTRAINT [InsuranceForm_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CommunicationLog] ADD CONSTRAINT [CommunicationLog_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CommunicationLog] ADD CONSTRAINT [CommunicationLog_emailTemplateId_fkey] FOREIGN KEY ([emailTemplateId]) REFERENCES [dbo].[EmailTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CommunicationLog] ADD CONSTRAINT [CommunicationLog_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CandidatePortalToken] ADD CONSTRAINT [CandidatePortalToken_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CandidatePortalMessage] ADD CONSTRAINT [CandidatePortalMessage_candidateId_fkey] FOREIGN KEY ([candidateId]) REFERENCES [dbo].[Candidate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
EXEC SP_RENAME N'dbo.AllowanceConfig.IX_AllowanceConfig_companyId', N'AllowanceConfig_companyId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.AttendanceBonusConfig.UQ_AttendanceBonusConfig_companyId', N'AttendanceBonusConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.AttendanceColorConfig.UQ_AttendanceColorConfig_companyId', N'AttendanceColorConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.AttendancePolicy.UQ_AttendancePolicy_companyId', N'AttendancePolicy_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.BankFileTemplate.IX_BankFileTemplate_companyId', N'BankFileTemplate_companyId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.BankFileTemplate.UQ_BankFileTemplate_companyId_code', N'BankFileTemplate_companyId_code_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.CanteenToken.IX_CanteenToken_employeeId_date', N'CanteenToken_employeeId_date_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.CompOffBalance.UQ_CompOffBalance_employeeId', N'CompOffBalance_employeeId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.CompOffPolicy.UQ_CompOffPolicy_companyId', N'CompOffPolicy_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.CompOffTransaction.IX_CompOffTransaction_employeeId_date', N'CompOffTransaction_employeeId_date_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.DoubleMachineEntry.IX_DoubleMachineEntry_employeeId', N'DoubleMachineEntry_employeeId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.FnFSettlement.IX_FnFSettlement_companyId_status', N'FnFSettlement_companyId_status_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.FnFSettlement.UQ_FnFSettlement_exitInterviewId', N'FnFSettlement_exitInterviewId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.FullAndFinalConfig.UQ_FullAndFinalConfig_companyId', N'FullAndFinalConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.GateNumberRegister.IX_GateNumberRegister_companyId_dcNo', N'GateNumberRegister_companyId_dcNo_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.GateNumberRegister.IX_GateNumberRegister_companyId_movementType', N'GateNumberRegister_companyId_movementType_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.GateNumberRegister.IX_GateNumberRegister_companyId_status', N'GateNumberRegister_companyId_status_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.GateNumberRegister.UQ__GateNumb__4D9C4C1A6A643B28', N'GateNumberRegister_gnrNo_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.GNRLineItem.IX_GNRLineItem_gnrId', N'GNRLineItem_gnrId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.HealthInsuranceConfig.UQ_HealthInsuranceConfig_companyId', N'HealthInsuranceConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.IncentivePolicy.IX_IncentivePolicy_companyId_type', N'IncentivePolicy_companyId_type_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.LeaveEncashmentConfig.UQ_LeaveEncashmentConfig_companyId', N'LeaveEncashmentConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.LicDeductionConfig.UQ_LicDeductionConfig_companyId', N'LicDeductionConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.Loan.IX_Loan_companyId_status', N'Loan_companyId_status_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.Loan.IX_Loan_employeeId', N'Loan_employeeId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.Loan.UQ_Loan_companyId_code', N'Loan_companyId_code_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.LoanInstallment.IX_LoanInstallment_loanId_installmentNumber', N'LoanInstallment_loanId_installmentNumber_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.LomConfig.UQ_LomConfig_companyId', N'LomConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.LwfRate.IX_LwfRate_companyId_state', N'LwfRate_companyId_state_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.LwfRate.UQ_LwfRate_companyId_state_effectiveFrom', N'LwfRate_companyId_state_effectiveFrom_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.ManualArrear.IX_ManualArrear_companyId_status', N'ManualArrear_companyId_status_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.ManualArrear.IX_ManualArrear_employeeId', N'ManualArrear_employeeId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.OTIncentiveSlab.IX_OTIncentiveSlab_companyId_code', N'OTIncentiveSlab_companyId_code_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.OTIncentiveSlab.IX_OTIncentiveSlab_effectiveFrom_effectiveTo', N'OTIncentiveSlab_effectiveFrom_effectiveTo_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.PayrollDisplayConfig.UQ_PayrollDisplayConfig_companyId', N'PayrollDisplayConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.PayrollValidationConfig.UQ_PayrollValidationConfig_companyId', N'PayrollValidationConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.PayrollWorkflowConfig.UQ_PayrollWorkflowConfig_companyId', N'PayrollWorkflowConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.PetrolAllowanceEntry.IX_PetrolAllowanceEntry_employeeId', N'PetrolAllowanceEntry_employeeId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.PetrolAllowanceEntry.IX_PetrolAllowanceEntry_employeeId_year_month', N'PetrolAllowanceEntry_employeeId_year_month_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.RoundingConfig.UQ_RoundingConfig_companyId', N'RoundingConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.StatePtConfig.IX_StatePtConfig_companyId_state', N'StatePtConfig_companyId_state_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.StatePtConfig.UQ_StatePtConfig_companyId_state_effectiveFrom', N'StatePtConfig_companyId_state_effectiveFrom_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.TdsInvestmentDeclaration.IX_TdsInvestmentDeclaration_companyId_financialYear', N'TdsInvestmentDeclaration_companyId_financialYear_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.TdsInvestmentDeclaration.IX_TdsInvestmentDeclaration_employeeId_financialYear', N'TdsInvestmentDeclaration_employeeId_financialYear_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.TdsInvestmentProof.IX_TdsInvestmentProof_declarationId', N'TdsInvestmentProof_declarationId_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.TdsRegimeConfig.UQ_TdsRegimeConfig_companyId', N'TdsRegimeConfig_companyId_key', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.VisitorNotificationLog.IX_VisitorNotificationLog_companyId_createdAt', N'VisitorNotificationLog_companyId_createdAt_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.VisitorNotificationLog.IX_VisitorNotificationLog_companyId_event', N'VisitorNotificationLog_companyId_event_idx', N'INDEX';

-- RenameIndex
EXEC SP_RENAME N'dbo.VisitorNotificationLog.IX_VisitorNotificationLog_companyId_status', N'VisitorNotificationLog_companyId_status_idx', N'INDEX';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

