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
    label: "Dashboard",
    icon: "home",
    href: "/",
    groups: [
      {
        label: "Overview",
        items: [{ label: "My Dashboard", href: "/", ready: true }],
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
          { label: "Companies", href: "/masters/companies", ready: true },
          { label: "Departments", href: "/masters/departments", ready: true },
          { label: "Sub Departments", href: "/masters/sub-departments", ready: true },
          { label: "Branches / Sites", short: "Branches", href: "/masters/branches" },
          { label: "Units", href: "/masters/units", ready: true },
          { label: "Reporting Structure", short: "Reporting", href: "/masters/reporting-structure" },
        ],
      },
      {
        label: "Employee",
        items: [
          { label: "Designations", href: "/masters/designations", ready: true },
          { label: "Employee Types", href: "/masters/employee-types", ready: true },
          { label: "Employee Categories", href: "/masters/categories", ready: true },
          { label: "Grades", href: "/masters/grades", ready: true },
          { label: "Levels", href: "/masters/levels", ready: true },
        ],
      },
      {
        label: "Workforce",
        items: [
          { label: "Shift Master", href: "/masters/shift-masters", ready: true },
          { label: "Shift Plans", href: "/masters/shift-plans", ready: true },
          { label: "OT Plans", href: "/masters/ot-plans", ready: true },
          { label: "Leave Master", href: "/masters/leave-masters", ready: true },
        ],
      },
      {
        label: "Payroll & Statutory",
        items: [
          { label: "Loan Types", href: "/masters/loan-types", ready: true },
          { label: "TDS Slabs", href: "/masters/tds-slabs", ready: true },
          { label: "Professional Tax Slabs", short: "PT Slabs", href: "/masters/professional-tax-slabs", ready: true },
          { label: "Income Tax Slabs", href: "/masters/income-tax-slabs" },
        ],
      },
      {
        label: "HR Masters",
        items: [
          { label: "Interview Criteria", href: "/masters/interview-criteria" },
          { label: "JD Master", href: "/masters/jd-master" },
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
          { label: "Exit Form", href: "/employees/separation/exit-form" },
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
          { label: "Daily Attendance", href: "/workforce/attendance/daily" },
          { label: "Monthly Attendance", href: "/workforce/attendance/monthly" },
          { label: "Biometric Integration", short: "Biometric", href: "/workforce/attendance/biometric" },
          { label: "Time Office Final", href: "/workforce/attendance/time-office-final" },
        ],
      },
      {
        label: "Leave",
        items: [
          { label: "Leave Entry", href: "/workforce/leave/entry" },
          { label: "Leave Approval", href: "/workforce/leave/approval" },
          { label: "Leave History", href: "/workforce/leave/history" },
        ],
      },
      {
        label: "Overtime",
        items: [
          { label: "OT Process", href: "/workforce/overtime/process" },
          { label: "OT Approval", href: "/workforce/overtime/approval" },
        ],
      },
      {
        label: "Requests",
        items: [
          { label: "Comp-Off Approval", href: "/workforce/requests/comp-off" },
          { label: "Permission Entry", href: "/workforce/requests/permission" },
        ],
      },
      {
        label: "Benefits",
        items: [
          { label: "Canteen Token", href: "/workforce/benefits/canteen-token" },
          { label: "Petrol Allowance", href: "/workforce/benefits/petrol-allowance" },
          { label: "Performance Incentive", href: "/workforce/benefits/performance-incentive" },
          { label: "Double Machine & Other Incentive", short: "Other Incentives", href: "/workforce/benefits/other-incentive" },
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
          { label: "Salary Processing", href: "/payroll/processing/salary" },
          { label: "Salary Revision", href: "/payroll/processing/revision" },
          { label: "Arrears", href: "/payroll/processing/arrears" },
          { label: "Bonus", href: "/payroll/processing/bonus" },
          { label: "Gratuity", href: "/payroll/processing/gratuity" },
          { label: "Leave Encashment", href: "/payroll/processing/leave-encashment" },
          { label: "Professional Tax", href: "/payroll/processing/professional-tax" },
          { label: "Full & Final Settlement", short: "Full & Final", href: "/payroll/processing/full-and-final" },
          { label: "Other Incentives", href: "/payroll/processing/other-incentives" },
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
          { label: "Payslip (Individual)", short: "Payslip", href: "/payroll/outputs/payslip" },
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
        label: "Visitor",
        items: [{ label: "Visitor Pass", href: "/visitor/pass" }],
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
          { label: "OT Approval", short: "Overtime", href: "/approvals/workforce/overtime" },
          { label: "Comp-Off Approval", short: "Comp-Off", href: "/approvals/workforce/comp-off" },
          { label: "Permission Approval", short: "Permission", href: "/approvals/workforce/permission" },
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
        items: [{ label: "Visitor Pass Approval", short: "Visitor Pass", href: "/approvals/visitor/pass" }],
      },
    ],
  },

  {
    label: "Employee Self Service",
    icon: "ess",
    short: "Self Service",
    href: "/ess",
    groups: [
      {
        label: "Services",
        items: [
          { label: "Attendance", href: "/ess/attendance" },
          { label: "Leave Management", short: "Leave", href: "/ess/leave" },
          { label: "Permission Requests", short: "Permission", href: "/ess/permission" },
          { label: "Mis-Punch Requests", short: "Mis-Punch", href: "/ess/mis-punch" },
        ],
      },
      {
        label: "Profile",
        items: [
          { label: "Employee Dashboard", short: "Dashboard", href: "/ess/dashboard" },
          { label: "Profile Update", href: "/ess/profile" },
          { label: "Document Download", short: "Documents", href: "/ess/documents" },
          { label: "Payslip Download", short: "Payslip", href: "/ess/payslip" },
        ],
      },
      {
        label: "Visitor",
        items: [
          { label: "Visitor Pass Request", short: "Pass Request", href: "/ess/visitor-request" },
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
          { label: "Headcount", href: "/reports/employee/headcount" },
        ],
      },
      {
        label: "Attendance",
        items: [
          { label: "Attendance Statement", short: "Statement", href: "/reports/attendance/statement" },
          { label: "Leave Summary", href: "/reports/attendance/leave-summary" },
          { label: "OT Report", short: "Overtime", href: "/reports/attendance/overtime" },
          { label: "Comp-Off Report", short: "Comp-Off", href: "/reports/attendance/comp-off" },
        ],
      },
      {
        label: "Payroll",
        items: [
          { label: "Salary Statement", href: "/reports/payroll/salary-statement" },
          { label: "Bank Statement", href: "/reports/payroll/bank-statement" },
          { label: "Payslip Report", short: "Payslip", href: "/reports/payroll/payslip" },
          { label: "OT Comparison Report", short: "OT Comparison", href: "/reports/payroll/ot-comparison" },
          { label: "Salary Reconciliation", short: "Reconciliation", href: "/reports/payroll/reconciliation" },
          { label: "Performance Incentive Report", short: "Performance Incentive", href: "/reports/payroll/performance-incentive" },
          { label: "OT & Other Incentive Report", short: "OT & Other Incentive", href: "/reports/payroll/ot-other-incentive" },
          { label: "Arrear Report", short: "Arrears", href: "/reports/payroll/arrears" },
          { label: "Salary Revision Report", short: "Salary Revision", href: "/reports/payroll/salary-revision" },
        ],
      },
      {
        label: "Statutory",
        items: [
          { label: "PF Report", short: "PF", href: "/reports/statutory/pf" },
          { label: "ESI Report", short: "ESI", href: "/reports/statutory/esi" },
          { label: "Professional Tax Report", short: "Professional Tax", href: "/reports/statutory/professional-tax" },
          { label: "Labour Welfare Fund Report", short: "LWF", href: "/reports/statutory/lwf" },
          { label: "ESI Return Report", short: "ESI Return", href: "/reports/statutory/esi-return" },
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
          { label: "Page Permissions", href: "/admin/page-permissions" },
        ],
      },
      {
        label: "Company Settings",
        items: [
          { label: "Company Profile", href: "/admin/company-profile" },
          { label: "Branch Configuration", short: "Branch Config", href: "/admin/branch-configuration" },
          { label: "Salary Logic", href: "/admin/salary-logic" },
          { label: "Organization Chart", short: "Org Chart", href: "/admin/organization-chart" },
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
