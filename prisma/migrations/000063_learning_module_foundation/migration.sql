BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[JobPosting] DROP COLUMN [closingDate],
[employmentType],
[locationId],
[maxExperienceYears],
[maxSalary],
[minExperienceYears],
[minSalary],
[vacancies];

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
ALTER TABLE [dbo].[RoundingConfig] DROP CONSTRAINT [DF_RoundingConfig_applyTo],
[DF_RoundingConfig_roundingMode],
[DF_RoundingConfig_showRoundOff];
EXEC SP_RENAME N'dbo.PK_RoundingConfig', N'RoundingConfig_pkey';
ALTER TABLE [dbo].[RoundingConfig] ADD CONSTRAINT [RoundingConfig_applyTo_df] DEFAULT 'NET_ONLY' FOR [applyTo], CONSTRAINT [RoundingConfig_roundingMode_df] DEFAULT 'NEAREST_1' FOR [roundingMode], CONSTRAINT [RoundingConfig_showRoundOff_df] DEFAULT 1 FOR [showRoundOff];

-- AlterTable
ALTER TABLE [dbo].[SalaryComponent] DROP CONSTRAINT [DF__SalaryCom__gross__019419E5],
[DF__SalaryCom__inclu__009FF5AC];
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

-- DropTable
DROP TABLE [dbo].[AppointmentOrder];

-- DropTable
DROP TABLE [dbo].[AppointmentTemplate];

-- DropTable
DROP TABLE [dbo].[BgvStep];

-- DropTable
DROP TABLE [dbo].[CallInterview];

-- DropTable
DROP TABLE [dbo].[Candidate];

-- DropTable
DROP TABLE [dbo].[CandidateActivityLog];

-- DropTable
DROP TABLE [dbo].[CandidateBgv];

-- DropTable
DROP TABLE [dbo].[CandidateChecklistItem];

-- DropTable
DROP TABLE [dbo].[CandidateDetail];

-- DropTable
DROP TABLE [dbo].[CandidateDocument];

-- DropTable
DROP TABLE [dbo].[CandidateJoining];

-- DropTable
DROP TABLE [dbo].[CandidateOtherDocument];

-- DropTable
DROP TABLE [dbo].[CandidatePortalMessage];

-- DropTable
DROP TABLE [dbo].[CandidatePortalToken];

-- DropTable
DROP TABLE [dbo].[ChecklistMaster];

-- DropTable
DROP TABLE [dbo].[CommunicationLog];

-- DropTable
DROP TABLE [dbo].[DesignationLevel];

-- DropTable
DROP TABLE [dbo].[DesignationLevelMapping];

-- DropTable
DROP TABLE [dbo].[DocumentType];

-- DropTable
DROP TABLE [dbo].[EmailTemplate];

-- DropTable
DROP TABLE [dbo].[EmployeeIdConfig];

-- DropTable
DROP TABLE [dbo].[EmployeeIdSequence];

-- DropTable
DROP TABLE [dbo].[EsiApplication];

-- DropTable
DROP TABLE [dbo].[GratuityNomination];

-- DropTable
DROP TABLE [dbo].[GratuityNominee];

-- DropTable
DROP TABLE [dbo].[InsuranceForm];

-- DropTable
DROP TABLE [dbo].[Internship];

-- DropTable
DROP TABLE [dbo].[InternshipPolicy];

-- DropTable
DROP TABLE [dbo].[InterviewCriteria];

-- DropTable
DROP TABLE [dbo].[InterviewEvaluation];

-- DropTable
DROP TABLE [dbo].[InterviewEvaluationSummary];

-- DropTable
DROP TABLE [dbo].[InterviewLevel];

-- DropTable
DROP TABLE [dbo].[InterviewPanel];

-- DropTable
DROP TABLE [dbo].[InterviewProcess];

-- DropTable
DROP TABLE [dbo].[InterviewProcessLevel];

-- DropTable
DROP TABLE [dbo].[InterviewSchedule];

-- DropTable
DROP TABLE [dbo].[InterviewScoreConfig];

-- DropTable
DROP TABLE [dbo].[InterviewType];

-- DropTable
DROP TABLE [dbo].[JoiningApprovalMatrix];

-- DropTable
DROP TABLE [dbo].[JoiningForm];

-- DropTable
DROP TABLE [dbo].[JoiningReport];

-- DropTable
DROP TABLE [dbo].[OfferLetter];

-- DropTable
DROP TABLE [dbo].[OfferTemplate];

-- DropTable
DROP TABLE [dbo].[OtherJoiningDocType];

-- DropTable
DROP TABLE [dbo].[PfNomination];

-- DropTable
DROP TABLE [dbo].[PfNominee];

-- DropTable
DROP TABLE [dbo].[RecruitmentApprovalMatrix];

-- DropTable
DROP TABLE [dbo].[RecruitmentStatus];

-- DropTable
DROP TABLE [dbo].[SlaConfig];

-- DropTable
DROP TABLE [dbo].[SourcingChannel];

-- CreateTable
CREATE TABLE [dbo].[SkillLevel] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [levelNumber] INT NOT NULL,
    [name] NVARCHAR(50) NOT NULL,
    [description] NVARCHAR(500),
    [color] NVARCHAR(7),
    [isActive] BIT NOT NULL CONSTRAINT [SkillLevel_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SkillLevel_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SkillLevel_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SkillLevel_companyId_levelNumber_key] UNIQUE NONCLUSTERED ([companyId],[levelNumber])
);

-- CreateTable
CREATE TABLE [dbo].[Competency] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [code] NVARCHAR(20),
    [name] NVARCHAR(100) NOT NULL,
    [category] NVARCHAR(50) NOT NULL,
    [type] NVARCHAR(50),
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Competency_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Competency_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Competency_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CompetencyRequirement] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [competencyId] INT NOT NULL,
    [departmentId] INT,
    [designationId] INT,
    [gradeId] INT,
    [requiredLevelId] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [CompetencyRequirement_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CompetencyRequirement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CompetencyRequirement_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeCompetency] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [competencyId] INT NOT NULL,
    [currentLevelId] INT NOT NULL,
    [targetLevelId] INT,
    [certificationNumber] NVARCHAR(50),
    [certifiedDate] DATETIME2,
    [expiryDate] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [EmployeeCompetency_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmployeeCompetency_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeCompetency_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EmployeeCompetency_companyId_employeeId_competencyId_key] UNIQUE NONCLUSTERED ([companyId],[employeeId],[competencyId])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingProgram] (
    [id] INT NOT NULL IDENTITY(1,1),
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
    [durationUnit] NVARCHAR(20) CONSTRAINT [TrainingProgram_durationUnit_df] DEFAULT 'HOURS',
    [assessmentRequired] BIT NOT NULL CONSTRAINT [TrainingProgram_assessmentRequired_df] DEFAULT 0,
    [certificationRequired] BIT NOT NULL CONSTRAINT [TrainingProgram_certificationRequired_df] DEFAULT 0,
    [validityMonths] INT,
    [refresherFrequency] NVARCHAR(50),
    [estimatedCost] DECIMAL(18,2),
    [isActive] BIT NOT NULL CONSTRAINT [TrainingProgram_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingProgram_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingProgram_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Trainer] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(100),
    [phone] NVARCHAR(20),
    [isExternal] BIT NOT NULL CONSTRAINT [Trainer_isExternal_df] DEFAULT 0,
    [vendor] NVARCHAR(100),
    [commercialRate] DECIMAL(18,2),
    [contractDetails] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Trainer_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Trainer_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Trainer_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingVenue] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [capacity] INT,
    [location] NVARCHAR(200),
    [equipment] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [TrainingVenue_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingVenue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingVenue_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingPlan] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [year] NVARCHAR(9) NOT NULL,
    [departmentId] INT,
    [title] NVARCHAR(200),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingPlan_status_df] DEFAULT 'DRAFT',
    [totalEstimatedCost] DECIMAL(18,2),
    [totalApprovedBudget] DECIMAL(18,2),
    [approvedByUserId] INT,
    [approvedAt] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [TrainingPlan_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingPlan_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingPlanLine] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [trainingPlanId] INT NOT NULL,
    [competencyId] INT,
    [plannedMonth] INT NOT NULL,
    [trainingProgramId] INT NOT NULL,
    [trainerId] INT,
    [trainingMethod] NVARCHAR(50),
    [duration] DECIMAL(8,2),
    [durationUnit] NVARCHAR(20) CONSTRAINT [TrainingPlanLine_durationUnit_df] DEFAULT 'HOURS',
    [participantCount] INT,
    [targetEmployeeIds] NVARCHAR(max),
    [estimatedCost] DECIMAL(18,2),
    [approvedAmount] DECIMAL(18,2),
    [priority] NVARCHAR(20) CONSTRAINT [TrainingPlanLine_priority_df] DEFAULT 'MEDIUM',
    [isMandatory] BIT NOT NULL CONSTRAINT [TrainingPlanLine_isMandatory_df] DEFAULT 0,
    [expectedOutcome] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingPlanLine_status_df] DEFAULT 'DRAFT',
    [tnaReference] NVARCHAR(100),
    [isActive] BIT NOT NULL CONSTRAINT [TrainingPlanLine_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingPlanLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingPlanLine_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TrainingSchedule] (
    [id] INT NOT NULL IDENTITY(1,1),
    [companyId] INT NOT NULL,
    [trainingPlanLineId] INT,
    [trainingProgramId] INT NOT NULL,
    [title] NVARCHAR(200),
    [scheduledDate] DATE,
    [startTime] NVARCHAR(8),
    [endTime] NVARCHAR(8),
    [duration] DECIMAL(8,2),
    [durationUnit] NVARCHAR(20) CONSTRAINT [TrainingSchedule_durationUnit_df] DEFAULT 'HOURS',
    [method] NVARCHAR(50),
    [venueId] INT,
    [meetingLink] NVARCHAR(500),
    [trainerId] INT,
    [coTrainerId] INT,
    [coordinator] NVARCHAR(100),
    [maxParticipants] INT,
    [targetDepartmentId] INT,
    [targetEmployeeIds] NVARCHAR(max),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [TrainingSchedule_status_df] DEFAULT 'PENDING',
    [isActive] BIT NOT NULL CONSTRAINT [TrainingSchedule_isActive_df] DEFAULT 1,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TrainingSchedule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TrainingSchedule_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SkillLevel_companyId_idx] ON [dbo].[SkillLevel]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Competency_companyId_category_idx] ON [dbo].[Competency]([companyId], [category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CompetencyRequirement_companyId_competencyId_idx] ON [dbo].[CompetencyRequirement]([companyId], [competencyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CompetencyRequirement_companyId_departmentId_designationId_gradeId_idx] ON [dbo].[CompetencyRequirement]([companyId], [departmentId], [designationId], [gradeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EmployeeCompetency_employeeId_idx] ON [dbo].[EmployeeCompetency]([employeeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingProgram_companyId_category_idx] ON [dbo].[TrainingProgram]([companyId], [category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Trainer_companyId_idx] ON [dbo].[Trainer]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingVenue_companyId_idx] ON [dbo].[TrainingVenue]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingPlan_companyId_year_idx] ON [dbo].[TrainingPlan]([companyId], [year]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingPlan_companyId_departmentId_idx] ON [dbo].[TrainingPlan]([companyId], [departmentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingPlanLine_companyId_trainingPlanId_idx] ON [dbo].[TrainingPlanLine]([companyId], [trainingPlanId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingPlanLine_companyId_plannedMonth_idx] ON [dbo].[TrainingPlanLine]([companyId], [plannedMonth]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingSchedule_companyId_scheduledDate_idx] ON [dbo].[TrainingSchedule]([companyId], [scheduledDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TrainingSchedule_companyId_status_idx] ON [dbo].[TrainingSchedule]([companyId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DepartmentWeeklyOff_companyId_departmentId_idx] ON [dbo].[DepartmentWeeklyOff]([companyId], [departmentId]);

-- CreateIndex
ALTER TABLE [dbo].[DepartmentWeeklyOff] ADD CONSTRAINT [DepartmentWeeklyOff_companyId_departmentId_weekOffDay_key] UNIQUE NONCLUSTERED ([companyId], [departmentId], [weekOffDay]);

-- CreateIndex
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_userId_key] UNIQUE NONCLUSTERED ([userId]);

-- CreateIndex
ALTER TABLE [dbo].[SalaryRevisionRequest] ADD CONSTRAINT [SalaryRevisionRequest_appliedRevisionId_key] UNIQUE NONCLUSTERED ([appliedRevisionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Site_unitId_idx] ON [dbo].[Site]([unitId]);

-- CreateIndex
ALTER TABLE [dbo].[SubDepartment] ADD CONSTRAINT [SubDepartment_departmentId_code_key] UNIQUE NONCLUSTERED ([departmentId], [code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Unit_businessUnitId_idx] ON [dbo].[Unit]([businessUnitId]);

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
ALTER TABLE [dbo].[CompetencyRequirement] ADD CONSTRAINT [CompetencyRequirement_competencyId_fkey] FOREIGN KEY ([competencyId]) REFERENCES [dbo].[Competency]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CompetencyRequirement] ADD CONSTRAINT [CompetencyRequirement_requiredLevelId_fkey] FOREIGN KEY ([requiredLevelId]) REFERENCES [dbo].[SkillLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeCompetency] ADD CONSTRAINT [EmployeeCompetency_competencyId_fkey] FOREIGN KEY ([competencyId]) REFERENCES [dbo].[Competency]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeCompetency] ADD CONSTRAINT [EmployeeCompetency_currentLevelId_fkey] FOREIGN KEY ([currentLevelId]) REFERENCES [dbo].[SkillLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EmployeeCompetency] ADD CONSTRAINT [EmployeeCompetency_targetLevelId_fkey] FOREIGN KEY ([targetLevelId]) REFERENCES [dbo].[SkillLevel]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TrainingPlanLine] ADD CONSTRAINT [TrainingPlanLine_trainingPlanId_fkey] FOREIGN KEY ([trainingPlanId]) REFERENCES [dbo].[TrainingPlan]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TrainingPlanLine] ADD CONSTRAINT [TrainingPlanLine_competencyId_fkey] FOREIGN KEY ([competencyId]) REFERENCES [dbo].[Competency]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TrainingPlanLine] ADD CONSTRAINT [TrainingPlanLine_trainingProgramId_fkey] FOREIGN KEY ([trainingProgramId]) REFERENCES [dbo].[TrainingProgram]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TrainingSchedule] ADD CONSTRAINT [TrainingSchedule_trainingProgramId_fkey] FOREIGN KEY ([trainingProgramId]) REFERENCES [dbo].[TrainingProgram]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

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

