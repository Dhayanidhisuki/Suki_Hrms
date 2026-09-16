import type { IconName } from "./NavIcons";

/**
 * KUN / Suki HRMS navigation tree.
 *
 * Structure mirrors the BRD sidebar exactly: Module > Group > Item.
 * `ready: true` marks routes that already have a real page; everything else
 * resolves to the placeholder screen until its module is built.
 */

export type NavLeaf = {
  /** Full BRD name. Used for page titles, breadcrumbs and search results. */
  label: string;
  /** Compact name shown in the sidebar rail. Falls back to `label`. */
  short?: string;
  href: string;
  ready?: boolean;
  /** Restrict to a specific role code (e.g. 'company-admin'). */
  requiredRole?: string;
};

export type NavGroup = {
  label: string;
  items: NavLeaf[];
};

export type NavModule = {
  /** Full BRD module name. */
  label: string;
  /** Compact name shown in the sidebar rail. Falls back to `label`. */
  short?: string;
  icon: IconName;
  href: string;
  groups: NavGroup[];
};

export const navigation: NavModule[] = [
  {
    label: "Superadmin",
    icon: "settings",
    href: "/superadmin",
    groups: [
      {
        label: "Tenants",
        items: [{ label: "Companies", href: "/superadmin/companies", ready: true }],
      },
    ],
  },

  {
    label: "Dashboard",
    icon: "home",
    href: "/",
    groups: [
      {
        label: "Overview",
        items: [
          { label: "My Dashboard", href: "/", ready: true },
          { label: "Manager Dashboard", short: "My Team", href: "/manager/dashboard", ready: true },
        ],
      },
      {
        label: "Security",
        items: [{ label: "Security Dashboard", short: "Security", href: "/dashboard/security", ready: true }],
      },
      {
        label: "HR",
        items: [
          { label: "Headcount (Department-wise)", short: "Headcount by Dept", href: "/dashboard/headcount" },
          { label: "Attrition", href: "/dashboard/attrition" },
          { label: "Attendance Summary", href: "/dashboard/attendance-summary" },
          { label: "Leave Summary", href: "/dashboard/leave-summary" },
          { label: "Payroll Status", href: "/dashboard/payroll-status" },
        ],
      },
      {
        label: "Payroll",
        items: [
          { label: "Payroll Processing Status", short: "Processing Status", href: "/dashboard/payroll-processing-status" },
          { label: "Salary Cost", href: "/dashboard/salary-cost" },
          { label: "Statutory Summary", href: "/dashboard/statutory-summary" },
          { label: "Pending Salary", href: "/dashboard/pending-salary" },
        ],
      },
    ],
  },

  {
    label: "Masters",
    icon: "masters",
    href: "/masters",
    groups: [
      {
        label: "Organization",
        items: [
          { label: "Departments", href: "/masters/departments", ready: true },
          { label: "Sub Departments", href: "/masters/sub-departments", ready: true },
          { label: "Branch / Unit", href: "/masters/units", ready: true },
          { label: "Site Master", href: "/masters/sites", ready: true },
          // Employee Master BRD §5 also defines Business Unit and Location,
          // but Unit already serves that role in this app — kept out of the
          // menu to avoid two masters for the same concept (2026-09-15).
          { label: "Cost Centres", href: "/masters/cost-centres", ready: true },
          // Reporting Structure is now a real module (org chart, manager
          // approval stages, bulk reassign) — see /masters/reporting-structure.
          { label: "Reporting Structure", short: "Reporting", href: "/masters/reporting-structure", ready: true },
        ],
      },
      {
        label: "Employee",
        items: [
          { label: "Employee Types", href: "/masters/employee-types", ready: true },
          { label: "Employee Categories", href: "/masters/categories", ready: true },
          // Designations + Grades are tabs on one page; their old routes redirect there.
          { label: "Designations & Grades", href: "/masters/designations-grades", ready: true },
          { label: "Levels", href: "/masters/levels", ready: true },
        ],
      },
      {
        label: "Workforce",
        items: [
          { label: "Shift Master", href: "/masters/shift-masters", ready: true },
          { label: "Shift Rotation Plans", href: "/masters/shift-rotation-plans", ready: true },
          { label: "OT Plans", href: "/masters/ot-plans", ready: true },
          { label: "OT Incentive Slabs", href: "/masters/ot-incentive-slabs", ready: true },
          { label: "Leave Master", href: "/masters/leave-masters", ready: true },
          { label: "Holiday Master", href: "/masters/holidays", ready: true },
          { label: "Attendance Policy", href: "/masters/attendance-policy", ready: true },
          { label: "Attendance Color Config", short: "Color Config", href: "/masters/attendance-color-config", ready: true },
          { label: "Comp-Off Policy", href: "/masters/comp-off-policy", ready: true },
        ],
      },
      {
        label: "Payroll & Statutory",
        items: [
          { label: "Loan Types", href: "/masters/loan-types", ready: true },
          { label: "Deduction Rates", href: "/masters/deduction-rates", ready: true },
          { label: "TDS Slabs", href: "/masters/tds-slabs", ready: true },
          { label: "TDS Regime Config", href: "/masters/tds-regime-config", ready: true },
          { label: "Professional Tax Slabs", short: "PT Slabs", href: "/masters/professional-tax-slabs", ready: true },
          { label: "State PT Configs", href: "/masters/state-pt-configs", ready: true },
          { label: "Income Tax Slabs", href: "/masters/income-tax-slabs" },
          { label: "Salary Components", href: "/masters/salary-components", ready: true },
          { label: "Benefit Components", href: "/masters/benefit-rates", ready: true },
          { label: "Bonus Rates", href: "/masters/bonus-rates", ready: true },
          { label: "Attendance Bonus Config", short: "Att Bonus", href: "/masters/attendance-bonus-config", ready: true },
          { label: "Gratuity Policies", href: "/masters/gratuity-policies", ready: true },
          { label: "Leave Encashment Config", href: "/masters/leave-encashment-config", ready: true },
          { label: "Full & Final Config", href: "/masters/full-and-final-config", ready: true },
          { label: "Incentive Policies", href: "/masters/incentive-policies", ready: true },
          { label: "Allowance Configs", href: "/masters/allowance-configs", ready: true },
          { label: "LIC Deduction Config", short: "LIC Config", href: "/masters/lic-deduction-config", ready: true },
          { label: "Health Insurance Config", short: "Health Ins", href: "/masters/health-insurance-config", ready: true },
          { label: "LWF Rates", href: "/masters/lwf-rates", ready: true },
          { label: "LOM Config", href: "/masters/lom-config", ready: true },
          { label: "Approval Chain Config", short: "Approval Chain", href: "/masters/approval-chain", ready: true },
          { label: "Rounding Config", href: "/masters/rounding-config", ready: true },
          { label: "Payroll Validation Config", short: "Validation", href: "/masters/payroll-validation-config", ready: true },
          { label: "Payroll Workflow Config", short: "Workflow", href: "/masters/payroll-workflow-config", ready: true },
          { label: "Payroll Display Config", short: "Display", href: "/masters/payroll-display-config", ready: true },
          { label: "Bank File Templates", href: "/masters/bank-file-templates", ready: true },
          { label: "Common Logic", href: "/masters/common-logic", ready: true },
        ],
      },
      {
        label: "HR Masters",
        items: [
          { label: "Interview Criteria", href: "/masters/interview-criteria" },
          { label: "JD Master", href: "/masters/jd-master", ready: true },
        ],
      },
      {
        // Not in the BRD sidebar list, but these pages already exist and work.
        label: "System",
        items: [
          { label: "ESI Rates", href: "/masters/esi-rates", ready: true },
          { label: "PF Rates", href: "/masters/pf-rates", ready: true },
          { label: "Asset Masters", href: "/masters/asset-masters", ready: true },
          { label: "Dropdown Master", href: "/masters/dropdown-master", ready: true },
        ],
      },
    ],
  },

  {
    label: "Recruitment",
    icon: "recruitment",
    href: "/recruitment",
    groups: [
      {
        label: "Hiring",
        items: [
          { label: "Job Postings", href: "/recruitment/job-postings", ready: true },
          { label: "Offer Letter", href: "/recruitment/offer-letter" },
          { label: "Appointment Order", href: "/recruitment/appointment-order" },
          { label: "Internship", href: "/recruitment/internship" },
        ],
      },
      {
        label: "Employee Joining",
        items: [
          { label: "Joining Checklist", href: "/recruitment/joining-checklist" },
          { label: "Joining Form", href: "/recruitment/joining-form" },
          { label: "Gratuity Form", href: "/recruitment/gratuity-form" },
          { label: "PF Form", href: "/recruitment/pf-form" },
          { label: "Insurance Form", href: "/recruitment/insurance-form" },
          { label: "ESI Form", href: "/recruitment/esi-form" },
          { label: "Other Joining Documents", short: "Other Documents", href: "/recruitment/other-documents" },
        ],
      },
    ],
  },

  {
    label: "Employees",
    icon: "employee",
    href: "/employees",
    groups: [
      {
        label: "Profile",
        items: [
          { label: "Employee Master", href: "/employees", ready: true },
          { label: "Employee Activity", href: "/employees/activity", ready: true },
        ],
      },
      {
        label: "Lifecycle",
        items: [
          { label: "Confirmation", href: "/employees/lifecycle/confirmation", ready: true },
          { label: "Transfer", href: "/employees/lifecycle/transfer" },
          { label: "Promotion", href: "/employees/lifecycle/promotion" },
          { label: "Designation Change", href: "/employees/lifecycle/designation-change" },
          { label: "Increment", href: "/employees/lifecycle/increment" },
        ],
      },
      {
        label: "Letters & Certificates",
        items: [
          { label: "Service Letter", href: "/employees/letters/service-letter" },
          { label: "Bonafide Certificate", href: "/employees/letters/bonafide-certificate" },
          { label: "Warning Letter", href: "/employees/letters/warning-letter" },
          { label: "Show Cause Notice", href: "/employees/letters/show-cause-notice" },
        ],
      },
      {
        label: "Separation",
        items: [
          { label: "Exit Form", href: "/employees/separation/exit-form", ready: true },
          { label: "Exit Interview Details", short: "Exit Interview", href: "/employees/separation/exit-interview" },
          { label: "No Due Form", href: "/employees/separation/no-due-form" },
          { label: "Relieving Letter", href: "/employees/separation/relieving-letter" },
        ],
      },
    ],
  },

  {
    label: "Workforce",
    icon: "workforce",
    href: "/workforce",
    groups: [
      {
        label: "Attendance",
        items: [
          { label: "Daily Attendance", href: "/workforce/attendance/daily", ready: true },
          { label: "Monthly Attendance", href: "/workforce/attendance/monthly", ready: true },
          { label: "Attendance Overview", short: "Overview", href: "/workforce/attendance/overview", ready: true },
          { label: "Biometric Integration", short: "Biometric", href: "/workforce/attendance/biometric", ready: true },
          { label: "Time Office Final", href: "/workforce/attendance/time-office-final" },
          { label: "Shift Plan", href: "/workforce/shift-plan", ready: true },
          { label: "Shift Change Request", short: "Shift Change", href: "/workforce/shift-change-request", ready: true },
          { label: "Shift Notifications", short: "Notifications", href: "/workforce/shift-notifications", ready: true },
          { label: "Bulk Shift Upload", short: "Bulk Upload", href: "/workforce/bulk-shift-upload", ready: true },
          { label: "Comp-off Request", short: "Comp-off", href: "/workforce/comp-off-request", ready: true },
        ],
      },
      {
        label: "Leave",
        items: [
          { label: "Leave Entry", href: "/workforce/leave/entry", ready: true },
          { label: "Leave Approval", href: "/workforce/leave/approval", ready: true },
          { label: "Leave History", href: "/workforce/leave/history", ready: true },
        ],
      },
      {
        label: "Overtime",
        items: [
          { label: "OT Process", href: "/workforce/overtime/process" },
          { label: "OT Approval", href: "/approvals/workforce/overtime", ready: true },
        ],
      },
      {
        label: "Requests",
        items: [
          { label: "Comp-Off Approval", href: "/workforce/leave/approval", ready: true },
          { label: "Permission Entry", href: "/ess/permission", ready: true },
        ],
      },
      {
        label: "Benefits",
        items: [
          // Benefits Overview shows KPI cards per benefit component and the
          // enrolled employees per benefit. Benefit components themselves
          // are configured in Masters → Benefit Components.
          { label: "Benefits Overview", href: "/workforce/benefits", ready: true },
          { label: "Performance Incentive", href: "/payroll/processing/pms-incentive", ready: true },
          { label: "Double Machine Incentive", href: "/payroll/processing/double-machine", ready: true },
        ],
      },
    ],
  },

  {
    label: "Payroll",
    icon: "payroll",
    href: "/payroll",
    groups: [
      {
        label: "Processing",
        items: [
          { label: "Salary Processing", href: "/payroll/processing/salary", ready: true },
          { label: "Additions & Deductions", href: "/payroll/processing/additions-deductions", ready: true },
          { label: "Salary Revision", href: "/payroll/processing/revision", ready: true },
          { label: "Arrears", href: "/payroll/processing/arrears", ready: true },
          { label: "Manual Arrears", href: "/payroll/processing/manual-arrears", ready: true },
          { label: "Bonus", href: "/payroll/processing/bonus", ready: true },
          { label: "Gratuity", href: "/payroll/processing/gratuity", ready: true },
          { label: "Leave Encashment", href: "/payroll/processing/leave-encashment" },
          { label: "Professional Tax", href: "/payroll/processing/professional-tax" },
          { label: "Full & Final Settlement", short: "Full & Final", href: "/payroll/processing/full-and-final" },
          { label: "Other Incentives", href: "/payroll/processing/double-machine", ready: true },
        ],
      },
      {
        label: "Statutory",
        items: [
          { label: "PF", href: "/payroll/statutory/pf" },
          { label: "ESI", href: "/payroll/statutory/esi" },
          { label: "Professional Tax", href: "/payroll/statutory/professional-tax" },
          { label: "TDS", href: "/payroll/statutory/tds" },
          { label: "Labour Welfare Fund", short: "LWF", href: "/payroll/statutory/lwf" },
        ],
      },
      {
        label: "Deductions",
        items: [
          { label: "Health Insurance", href: "/payroll/deductions/health-insurance" },
          { label: "Loan Recovery", href: "/payroll/deductions/loan-recovery" },
          { label: "Snacks Deduction", short: "Snacks", href: "/payroll/deductions/snacks" },
          { label: "Mobile Deduction", short: "Mobile", href: "/payroll/deductions/mobile" },
          { label: "Travel Deduction", short: "Travel", href: "/payroll/deductions/travel" },
          { label: "Lunch Deduction", short: "Lunch", href: "/payroll/deductions/lunch" },
          { label: "Other Deductions", short: "Others", href: "/payroll/deductions/other" },
        ],
      },
      {
        label: "Outputs",
        items: [
          { label: "Payslip (Individual)", short: "Payslip", href: "/payroll/outputs/payslip", ready: true },
          { label: "Payslip (Bulk)", short: "Bulk Payslip", href: "/payroll/outputs/payslip-bulk" },
          { label: "Payroll Summary", href: "/payroll/outputs/summary" },
          { label: "Bank Transfer File", short: "Bank Transfer", href: "/payroll/outputs/bank-transfer" },
          { label: "Payroll Reconciliation", short: "Reconciliation", href: "/payroll/outputs/reconciliation" },
        ],
      },
    ],
  },

  {
    label: "Learning & Development",
    icon: "learning",
    short: "Learning",
    href: "/learning",
    groups: [
      {
        label: "Competency",
        items: [
          { label: "Competency Management", short: "Competency", href: "/learning/competency" },
          { label: "Skill Matrix", href: "/learning/skill-matrix" },
          { label: "Skill Levels", href: "/learning/skill-levels" },
        ],
      },
      {
        label: "Training",
        items: [
          { label: "Yearly Training Plan", short: "Training Plan", href: "/learning/training-plan" },
          { label: "Training Calendar", href: "/learning/training-calendar" },
        ],
      },
    ],
  },

  {
    label: "Visitor",
    icon: "visitor",
    href: "/visitor",
    groups: [
      {
        label: "Gate",
        items: [
          { label: "Gate Inward", href: "/visitor/gate-inward" },
          { label: "Gate Outward", href: "/visitor/gate-outward" },
        ],
      },
      {
        label: "Material",
        items: [
          { label: "GNR Register", href: "/visitor/gnr" },
        ],
      },
      {
        label: "Visitor",
        items: [
          { label: "Vendor", href: "/visitor/vendor", requiredRole: "company-admin" },
          { label: "Visitor Pass", href: "/visitor/pass" },
        ],
      },
    ],
  },

  {
    label: "Document Management",
    icon: "document",
    short: "Documents",
    href: "/documents",
    groups: [
      {
        label: "Repository",
        items: [
          { label: "Recruitment Documents", short: "Recruitment", href: "/documents/recruitment" },
          { label: "Employee Documents", short: "Employee", href: "/documents/employee" },
          { label: "Letters & Certificates", short: "Letters", href: "/documents/letters" },
          { label: "Lifecycle Documents", short: "Lifecycle", href: "/documents/lifecycle" },
          { label: "Payroll Documents", short: "Payroll", href: "/documents/payroll" },
          { label: "Compliance Documents", short: "Compliance", href: "/documents/compliance" },
        ],
      },
    ],
  },

  {
    label: "Approval Center",
    icon: "approval",
    short: "Approvals",
    href: "/approvals",
    groups: [
      {
        label: "Recruitment",
        items: [
          { label: "Hiring Approval", short: "Hiring", href: "/approvals/recruitment/hiring" },
          { label: "Employee Joining Approval", short: "Employee Joining", href: "/approvals/recruitment/joining" },
        ],
      },
      {
        label: "Employees",
        items: [
          { label: "Confirmation", href: "/approvals/employees/confirmation" },
          { label: "Transfer", href: "/approvals/employees/transfer" },
          { label: "Promotion", href: "/approvals/employees/promotion" },
          { label: "Designation Change", href: "/approvals/employees/designation-change" },
          { label: "Increment", href: "/approvals/employees/increment" },
        ],
      },
      {
        label: "Workforce",
        items: [
          { label: "Leave Approval", short: "Leave", href: "/approvals/workforce/leave" },
          { label: "Mispunch Approval", short: "Mispunch", href: "/approvals/workforce/mispunch", ready: true },
          { label: "On-Duty Approval", short: "On-Duty", href: "/approvals/workforce/on-duty", ready: true },
          { label: "WFH Approval", short: "WFH", href: "/approvals/workforce/wfh", ready: true },
          { label: "OT Approval", short: "Overtime", href: "/approvals/workforce/overtime", ready: true },
          { label: "LOM Approval", short: "LOM", href: "/approvals/workforce/lom", ready: true },
          // Comp-Off has no separate approval queue: it's earned via OT Approval
          // (settling Sunday/holiday OT as Comp-Off instead of paid overtime) and
          // spent as a normal leave application against the "Compensatory Off"
          // leave type, reviewed on the existing Leave Approval page.
          { label: "Comp-Off Approval", short: "Comp-Off", href: "/workforce/leave/approval" },
          { label: "Permission Approval", short: "Permission", href: "/approvals/workforce/permission", ready: true },
        ],
      },
      {
        label: "Payroll",
        items: [
          { label: "Salary Processing Approval", short: "Salary Processing", href: "/approvals/payroll/salary-processing" },
          { label: "Salary Revision Approval", short: "Salary Revision", href: "/approvals/payroll/salary-revision" },
          { label: "Full & Final Settlement Approval", short: "Full & Final", href: "/approvals/payroll/full-and-final" },
        ],
      },
      {
        label: "Visitor",
        items: [{ label: "Visitor Pass Approval", short: "Visitor Pass", href: "/approvals/visitor/pass", ready: true }],
      },
    ],
  },

  {
    label: "Dashboard",
    icon: "home",
    href: "/ess/dashboard",
    short: "My Dashboard",
    groups: [
      {
        label: "Overview",
        items: [
          { label: "Employee Dashboard", href: "/ess/dashboard" },
        ],
      },
    ],
  },

  {
    label: "Services",
    icon: "services",
    href: "/ess/services",
    groups: [
      {
        label: "Request & Approval",
        items: [
          { label: "Attendance", href: "/ess/attendance", ready: true },
          { label: "Leave Management", short: "Leave", href: "/ess/leave", ready: true },
          { label: "Permission Requests", short: "Permission", href: "/ess/permission", ready: true },
          { label: "Mis-Punch Requests", short: "Mis-Punch", href: "/ess/mis-punch", ready: true },
          { label: "On-Duty (OD)", short: "On-Duty", href: "/ess/on-duty", ready: true },
          { label: "Work From Home", short: "WFH", href: "/ess/wfh", ready: true },
          { label: "Shift Change Request", short: "Shift Change", href: "/ess/shift-change", ready: true },
          { label: "Holiday Calendar", short: "Holidays", href: "/ess/holiday-calendar", ready: true },
        ],
      },
      {
        label: "Deductions & Allowances",
        items: [
          { label: "Petrol Allowance", short: "Petrol", href: "/ess/petrol-allowance", ready: true },
          { label: "Canteen Deductions", short: "Canteen", href: "/ess/canteen", ready: true },
        ],
      },
    ],
  },

  {
    label: "Profile",
    icon: "profile",
    href: "/ess/profile",
    groups: [
      {
        label: "My Information",
        items: [
          { label: "Profile Update", href: "/ess/profile", ready: true },
          { label: "Document Download", short: "Documents", href: "/ess/documents", ready: true },
          { label: "Payslip Download", short: "Payslip", href: "/ess/payslip", ready: true },
          { label: "OT Slip", short: "OT Slip", href: "/ess/ot-slip", ready: true },
          { label: "Income Tax", short: "Income Tax", href: "/ess/income-tax", ready: true },
          { label: "My Loans", short: "Loans", href: "/ess/loans", ready: true },
          { label: "My Benefits", short: "Benefits", href: "/ess/benefits", ready: true },
        ],
      },
    ],
  },

  {
    label: "Visitors",
    icon: "visitor",
    href: "/ess/visitor-request",
    groups: [
      {
        label: "Visitor Pass",
        items: [
          { label: "Visitor Pass Request", short: "Pass Request", href: "/ess/visitor-request", ready: true },
          { label: "Visitor Pass Approval", short: "Pass Approval", href: "/ess/visitor-approval" },
        ],
      },
    ],
  },

  {
    label: "Compliance",
    icon: "compliance",
    href: "/compliance",
    groups: [
      {
        label: "Factory Compliance",
        items: [
          { label: "Form 25 - Muster Roll", short: "Form 25 Muster Roll", href: "/compliance/form-25" },
          { label: "Form 15 - Leave with Wages", short: "Form 15 Leave Wages", href: "/compliance/form-15" },
          { label: "Form 25B - Payslip & Time Card", short: "Form 25B Payslip", href: "/compliance/form-25b" },
          { label: "Form 25C - Identity Card", short: "Form 25C ID Card", href: "/compliance/form-25c" },
          { label: "Form 21 - Half-Yearly Return", short: "Form 21 Half-Yearly", href: "/compliance/form-21" },
          { label: "Form 22 - Annual Return", short: "Form 22 Annual", href: "/compliance/form-22" },
        ],
      },
    ],
  },

  {
    label: "Reports",
    icon: "reports",
    href: "/reports",
    groups: [
      {
        label: "Employee",
        items: [
          { label: "Employee Summary", short: "Summary", href: "/reports/employee/summary" },
          { label: "KYC Report", short: "KYC", href: "/reports/employee/kyc" },
          { label: "Birthday List", short: "Birthdays", href: "/reports/employee/birthday" },
          { label: "Headcount", href: "/reports/headcount" },
        ],
      },
      {
        label: "Attendance",
        items: [
          { label: "Attendance Summary", short: "Summary", href: "/reports/attendance-summary" },
          { label: "Attendance Statement", short: "Statement", href: "/reports/attendance/statement" },
          { label: "Leave Summary", href: "/reports/leave" },
          { label: "Leave Report", short: "Leave", href: "/reports/attendance/leave-summary" },
          { label: "OT Report", short: "Overtime", href: "/reports/attendance/overtime" },
          { label: "Comp-Off Report", short: "Comp-Off", href: "/reports/attendance/comp-off" },
        ],
      },
      {
        label: "Payroll",
        items: [
          { label: "Payroll Summary", short: "Summary", href: "/reports/payroll-summary" },
          { label: "Exception Report", short: "Exceptions", href: "/reports/exceptions" },
          { label: "Salary Statement", href: "/reports/payroll/salary-statement" },
          { label: "Bank Statement", href: "/reports/payroll/bank-statement" },
          { label: "Payslip Report", short: "Payslip", href: "/reports/payroll/payslip" },
          { label: "OT Comparison Report", short: "OT Comparison", href: "/reports/payroll/ot-comparison" },
          { label: "Salary Reconciliation", short: "Reconciliation", href: "/reports/payroll/reconciliation" },
          { label: "Performance Incentive Report", short: "Performance Incentive", href: "/reports/payroll/performance-incentive" },
          { label: "OT & Other Incentive Report", short: "OT & Other Incentive", href: "/reports/payroll/ot-other-incentive", ready: true },
          { label: "Arrear Report", short: "Arrears", href: "/reports/payroll/arrears" },
          { label: "Salary Revision Report", short: "Salary Revision", href: "/reports/payroll/salary-revision" },
        ],
      },
      {
        label: "Statutory",
        items: [
          { label: "PF Report", short: "PF", href: "/reports/statutory/pf" },
          { label: "ESI Report", short: "ESI", href: "/reports/statutory/esi" },
          { label: "Professional Tax Report", short: "Professional Tax", href: "/reports/statutory/professional-tax", ready: true },
          { label: "Labour Welfare Fund Report", short: "LWF", href: "/reports/statutory/lwf" },
          { label: "ESI Return Report", short: "ESI Return", href: "/reports/statutory/esi-return" },
        ],
      },
      {
        label: "Visitor",
        items: [
          { label: "Visitor Register", short: "Visitor Register", href: "/reports/visitor/visitor-register", ready: true },
          { label: "Current Inside", short: "Current Inside", href: "/reports/visitor/current-inside", ready: true },
          { label: "GNR Register", short: "GNR Register", href: "/reports/visitor/gnr-register", ready: true },
        ],
      },
      {
        label: "Business",
        items: [
          { label: "Attrition Report", short: "Attrition", href: "/reports/business/attrition" },
          { label: "Increment Report", short: "Increment", href: "/reports/business/increment" },
          { label: "Budget Report", short: "Budget", href: "/reports/business/budget" },
          { label: "Bonus Report", short: "Bonus", href: "/reports/business/bonus" },
        ],
      },
      {
        label: "Finance",
        items: [
          { label: "Salary to Bank Report", short: "Salary to Bank", href: "/reports/finance/salary-to-bank" },
          { label: "Project Cost", href: "/reports/finance/project-cost" },
          { label: "Quarterly TDS Report", short: "Quarterly TDS", href: "/reports/finance/quarterly-tds" },
          { label: "Headcount", href: "/reports/finance/headcount" },
          { label: "ATM List", href: "/reports/finance/atm-list" },
          { label: "Overall HRMS Budget Comparison", short: "Budget Comparison", href: "/reports/finance/budget-comparison" },
          { label: "Unpaid Salary & OT List", short: "Unpaid Salary & OT", href: "/reports/finance/unpaid-salary-ot" },
          { label: "ESI & PF Comparison (FY)", short: "ESI & PF (FY)", href: "/reports/finance/esi-pf-comparison" },
          { label: "Department-wise Salary Details", short: "Salary by Dept", href: "/reports/finance/department-salary" },
          { label: "Revised Salary Comparison", short: "Revised Salary", href: "/reports/finance/revised-salary" },
        ],
      },
    ],
  },

  {
    label: "Administration",
    icon: "admin",
    short: "Admin",
    href: "/admin",
    groups: [
      {
        label: "User & Access",
        items: [
          { label: "Users", href: "/admin/users", ready: true },
          { label: "Roles", href: "/admin/roles", ready: true },
          { label: "Permissions", href: "/admin/permissions", ready: true },
          // Employee Master BRD §20: role × data scope.
          { label: "User Scopes", href: "/admin/user-scopes", ready: true },
          { label: "Page Permissions", href: "/admin/page-permissions" },
        ],
      },
      {
        label: "Company Settings",
        items: [
          { label: "Company Profile", href: "/admin/company-profile" },
          { label: "Branch Configuration", short: "Branch Config", href: "/admin/branch-configuration" },
          { label: "Salary Logic", href: "/admin/salary-logic" },
          { label: "Organization Chart", short: "Org Chart", href: "/admin/organization-chart", ready: true },
        ],
      },
      {
        label: "System Settings",
        items: [
          { label: "Email Configuration", short: "Email", href: "/admin/email-configuration" },
          { label: "WhatsApp Configuration", short: "WhatsApp", href: "/admin/whatsapp-configuration" },
          { label: "Utility Settings", short: "Utilities", href: "/admin/utility-settings" },
        ],
      },
    ],
  },
];

/** Flat list of every leaf route, used by search and the placeholder screen. */
export const allNavLeaves: (NavLeaf & { module: string; group: string })[] =
  navigation.flatMap((mod) =>
    mod.groups.flatMap((group) =>
      group.items.map((item) => ({ ...item, module: mod.label, group: group.label })),
    ),
  );
