const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  info: { Title: 'Suki HRMS - Manual Test Flow', Author: 'Suki HRMS' },
});

const out = fs.createWriteStream('D:\\HRMS\\Suki-HRMS-Manual-Test-Flow.pdf');
doc.pipe(out);

const W = doc.page.width - 100; // usable width
let y = doc.page.margins.top;

// ─── Helpers ──────────────────────────────────────────────────────────────
const ACCENT = '#22b573';
const DARK = '#16202c';
const MUTED = '#7c8898';
const BORDER = '#e9edf1';
const LIGHT_BG = '#f4f6f8';
const DANGER = '#ef5a3c';
const WARNING = '#f0b429';
const INFO = '#3b82f6';

function ensureSpace(h) {
  if (y + h > doc.page.height - 50) { doc.addPage(); y = 50; }
}

function heading(text, size = 16, color = DARK) {
  ensureSpace(size + 12);
  if (y > 60) y += 8;
  doc.fontSize(size).fillColor(color).font('Helvetica-Bold');
  doc.text(text, 50, y, { width: W });
  y += size + 6;
  // underline
  doc.moveTo(50, y - 2).lineTo(50 + W, y - 2).strokeColor(BORDER).lineWidth(1).stroke();
  y += 4;
  doc.fillColor(DARK);
}

function subheading(text, size = 12) {
  ensureSpace(size + 10);
  y += 4;
  doc.fontSize(size).fillColor(ACCENT).font('Helvetica-Bold');
  doc.text(text, 50, y, { width: W });
  y += size + 4;
  doc.fillColor(DARK);
}

function para(text, size = 9) {
  ensureSpace(size * 3);
  doc.fontSize(size).fillColor(DARK).font('Helvetica');
  doc.text(text, 50, y, { width: W, lineGap: 2 });
  y += doc.heightOfString(text, { width: W, lineGap: 2, size }) + 4;
}

function bullet(text, level = 0, size = 9) {
  const indent = 50 + level * 15;
  const w = W - level * 15;
  ensureSpace(size * 2);
  doc.fontSize(size).fillColor(DARK).font('Helvetica');
  const prefix = level === 0 ? '•  ' : '–  ';
  const fullText = prefix + text;
  doc.text(fullText, indent, y, { width: w, lineGap: 2 });
  y += doc.heightOfString(fullText, { width: w, lineGap: 2, size }) + 2;
}

function numbered(n, text, size = 9) {
  ensureSpace(size * 2);
  doc.fontSize(size).fillColor(DARK).font('Helvetica');
  const fullText = `${n}.  ${text}`;
  doc.text(fullText, 55, y, { width: W - 10, lineGap: 2 });
  y += doc.heightOfString(fullText, { width: W - 10, lineGap: 2, size }) + 2;
}

function code(text) {
  ensureSpace(20);
  doc.fontSize(8).fillColor('#333').font('Courier');
  doc.text(text, 55, y, { width: W - 10, lineGap: 1 });
  y += doc.heightOfString(text, { width: W - 10, lineGap: 1, size: 8 }) + 4;
  doc.fillColor(DARK).font('Helvetica');
}

function tableRow(cols, widths, isHeader = false, rowBg = null) {
  const rowH = 16;
  ensureSpace(rowH + 2);
  const x = 50;
  if (rowBg) {
    doc.rect(x, y - 2, W, rowH + 2).fillColor(rowBg).fill();
  }
  cols.forEach((c, i) => {
    doc.fontSize(isHeader ? 7.5 : 8).fillColor(isHeader ? MUTED : DARK).font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(c, x + (widths.slice(0, i).reduce((a, b) => a + b, 0)) + 3, y, { width: widths[i] - 6, height: rowH, ellipsis: true, lineBreak: false });
  });
  doc.moveTo(x, y - 2).lineTo(x + W, y - 2).strokeColor(BORDER).lineWidth(0.5).stroke();
  doc.moveTo(x, y + rowH).lineTo(x + W, y + rowH).strokeColor(BORDER).lineWidth(0.5).stroke();
  y += rowH + 2;
}

function hr() {
  ensureSpace(6);
  y += 2;
  doc.moveTo(50, y).lineTo(50 + W, y).strokeColor(BORDER).lineWidth(0.5).stroke();
  y += 4;
}

function callout(text, color = INFO) {
  ensureSpace(30);
  doc.roundedRect(50, y, W, doc.heightOfString(text, { width: W - 20, size: 9 }) + 12, 4).fillColor(color + '15').fill();
  doc.fontSize(9).fillColor(color).font('Helvetica');
  doc.text(text, 60, y + 6, { width: W - 20, lineGap: 2 });
  y += doc.heightOfString(text, { width: W - 20, size: 9 }) + 16;
  doc.fillColor(DARK).font('Helvetica');
}

function checkbox(text) {
  ensureSpace(14);
  doc.fontSize(10).fillColor(ACCENT).font('Helvetica-Bold');
  doc.text('☐', 50, y);
  doc.fontSize(9).fillColor(DARK).font('Helvetica');
  doc.text(text, 65, y + 1, { width: W - 15, lineGap: 2 });
  y += Math.max(14, doc.heightOfString(text, { width: W - 15, size: 9 }) + 4);
}

// ─── COVER PAGE ───────────────────────────────────────────────────────────
doc.rect(0, 0, doc.page.width, doc.page.height).fillColor(DARK).fill();
doc.fillColor('#fff').fontSize(32).font('Helvetica-Bold');
doc.text('Suki HRMS', 50, 200, { width: W, align: 'center' });
doc.fontSize(16).fillColor(ACCENT);
doc.text('Full Manual Test Flow', 50, 250, { width: W, align: 'center' });
doc.fontSize(11).fillColor('#a0a8b0').font('Helvetica');
doc.text('Step-by-step guide to test every module end-to-end', 50, 280, { width: W, align: 'center' });
doc.text('Biometric · Attendance · Time Office · Shifts · OT · LOM · Comp-Off · Payroll', 50, 310, { width: W, align: 'center' });
doc.fontSize(9).fillColor('#606870');
doc.text('Version 1.0  |  September 2026', 50, doc.page.height - 80, { width: W, align: 'center' });
doc.addPage();
y = 50;

// ─── TABLE OF CONTENTS ────────────────────────────────────────────────────
heading('Table of Contents', 18);
const toc = [
  ['0', 'Server Check & Restart Steps', '4'],
  ['1', 'Masters Setup', '5'],
  ['2', 'Employee & Salary Structure', '8'],
  ['3', 'Biometric & Attendance', '9'],
  ['4', 'Approvals (OT, LOM, Mispunch, Leave)', '11'],
  ['5', 'Shift Management', '14'],
  ['6', 'Comp-Off', '17'],
  ['7', 'Payroll Processing (Full Pipeline)', '18'],
  ['8', 'Dashboards', '21'],
  ['9', 'Edge Cases & Error Handling', '22'],
  ['10', 'Quick Reference — All Page URLs', '24'],
  ['11', 'Test Checklist Summary', '25'],
];
tableRow(['#', 'Section', 'Page'], [30, W - 80, 50], true, LIGHT_BG);
toc.forEach(([n, title, page]) => tableRow([n, title, page], [30, W - 80, 50]));

// ─── PHASE 0: SERVER CHECK & RESTART ─────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 0 — Server Check & Restart Steps', 18, ACCENT);

callout('Before testing any feature, the database and dev server must both be running. Follow these steps every time you start a test session.', WARNING);

subheading('Step 0.1 — Check if SQL Server is running');
para("The database is hosted at 192.168.1.160:1433 (SQL Server). If the API returns 500 errors with 'Can't reach database server', the DB is down.");
numbered(1, 'Open PowerShell or Command Prompt');
numbered(2, 'Run this test command:');
code('   Test-NetConnection -ComputerName 192.168.1.160 -Port 1433');
numbered(3, 'If TcpTestSucceeded = True → DB is reachable. Continue to Step 0.3.');
numbered(4, 'If TcpTestSucceeded = False → DB is down. Continue to Step 0.2.');

subheading('Step 0.2 — Start SQL Server (if down)');
para('The SQL Server service may need to be started on the host machine (192.168.1.160):');
numbered(1, 'Log in to the server at 192.168.1.160 (RDP or local access)');
numbered(2, 'Open Services (services.msc)');
numbered(3, 'Find "SQL Server (MSSQLSERVER)" or the named instance');
numbered(4, 'Right-click → Start');
numbered(5, 'Wait for status = Running');
numbered(6, 'Re-run the Test-NetConnection command from Step 0.1');
numbered(7, 'If still failing, check firewall rules for port 1433');

subheading('Step 0.3 — Check if Next.js dev server is running');
numbered(1, 'Open a browser and go to: http://localhost:3000');
numbered(2, 'If you see the login page → server is running. Continue to Step 0.5.');
numbered(3, 'If the page does not load → server is down. Continue to Step 0.4.');

subheading('Step 0.4 — Start the Next.js dev server');
numbered(1, 'Open PowerShell in the HRMS project directory:');
code('   cd D:\\HRMS');
numbered(2, 'Start the dev server:');
code('   npm run dev');
numbered(3, 'Wait for the output:');
code('   ✓ Ready in XXXms');
code('   - Local:        http://localhost:3000');
code('   - Network:      http://192.168.100.3:3000');
numbered(4, 'If port 3000 is already in use, kill existing Node processes first:');
code('   Stop-Process -Name node -Force -ErrorAction SilentlyContinue');
code('   Start-Sleep 2');
code('   npm run dev');

subheading('Step 0.5 — Log in');
numbered(1, 'Open http://localhost:3000 in your browser');
numbered(2, 'You will be redirected to /login');
numbered(3, 'Log in with an admin or HR account (the account must have the required permissions)');
numbered(4, 'After login, you should see the dashboard');
numbered(5, 'The hrms-token cookie is now set — all pages and APIs will work');

subheading('Step 0.6 — Quick health check');
para('After login, verify the system is healthy by checking these 3 things:');
numbered(1, 'Go to /payroll/processing/salary → should load without errors');
numbered(2, 'Go to /workforce/shift-plan → should show the shift grid');
numbered(3, 'Go to /masters/holidays → should show the 3-tab holiday master');

callout('If any of these 3 pages show errors, the DB connection is likely still down. Go back to Step 0.2.', DANGER);

// ─── PHASE 1: MASTERS ────────────────────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 1 — Masters Setup', 18, ACCENT);
para('Verify all master configurations are in place before testing transactions. Each sub-section has verification steps and an action to test.');

// 1.1 Shift Master
subheading('1.1 Shift Master');
para('Page: /masters/shift-masters');
para('Verify:');
bullet('4+ shifts listed (GENERAL, MORNING, EVENING, NIGHT)');
bullet('Each has start/end time, grace minutes, night-allowed flag');
bullet('GENERAL = 09:00-17:30, NIGHT = 22:00-06:00');
para('Test:');
numbered(1, 'Click Edit on GENERAL');
numbered(2, 'Change grace minutes to 10');
numbered(3, 'Save');
numbered(4, 'Verify the value persists (reload the page)');
numbered(5, 'Change it back to the original value');

// 1.2 Departments
subheading('1.2 Departments');
para('Page: /masters/departments');
para('Verify:');
bullet('IT, MANAGEMENT REPRESENTATIVE, and other departments listed');
bullet('Each has a code and name');
para('Test:');
numbered(1, 'Note which departments exist — needed for weekly-off config');
numbered(2, 'Verify each active employee belongs to a department');

// 1.3 Holiday Master
doc.addPage(); y = 50;
subheading('1.3 Holiday Master (3 Tabs)');
para('Page: /masters/holidays');
para('This page has 3 tabs: Declared Holidays, Department Weekly Off, Yearly Leave Calendar.');

// Tab A
para('');
doc.fontSize(10).fillColor(ACCENT).font('Helvetica-Bold');
doc.text('Tab A — Declared Holidays', 50, y); y += 14;
doc.fillColor(DARK).font('Helvetica').fontSize(9);
para('Verify:');
bullet('List of holidays with date tile, name, type badge (Company/Festival/Government)');
bullet('Search and pagination work');
para('Test:');
numbered(1, 'Click "+ Add Holiday"');
numbered(2, 'Fill: Company = your company, Date = 2026-08-15, Name = Independence Day, Type = Government');
numbered(3, 'Save → verify it appears in the list with the correct date tile and type badge');
numbered(4, 'Click Edit on the new holiday → change type to Festival → Save → verify badge colour changes');
numbered(5, 'Click Delete → confirm → verify it disappears');

// Tab B
para('');
doc.fontSize(10).fillColor(ACCENT).font('Helvetica-Bold');
doc.text('Tab B — Department Weekly Off', 50, y); y += 14;
doc.fillColor(DARK).font('Helvetica').fontSize(9);
para('Verify:');
bullet('KPI strip: total departments, configured count, default (Sunday) count');
bullet('Each department shows a Mon-Sun chip row');
bullet('IT and MGMT REP have Sun+Sat highlighted (frozen = amber)');
bullet('"Effective weekly off" column shows the configured days');
para('Test:');
numbered(1, 'Find a department with no config (shows "Default · Sunday")');
numbered(2, 'Click the Saturday chip → it turns amber (frozen)');
numbered(3, 'Verify "Effective weekly off" column now shows Sunday + Saturday badges');
numbered(4, 'Click Saturday again → it unfreezes → back to "Default · Sunday"');
numbered(5, 'Use the filter box to search a department by name → verify list narrows');

// Tab C
doc.addPage(); y = 50;
doc.fontSize(10).fillColor(ACCENT).font('Helvetica-Bold');
doc.text('Tab C — Yearly Leave Calendar', 50, y); y += 14;
doc.fillColor(DARK).font('Helvetica').fontSize(9);
para('Verify:');
bullet('Calendar shows the current month with colour-coded day cells');
bullet('Leave Types panel on the right shows types with colour swatches and day counts');
bullet('Month list below shows entries for the visible month');
bullet('Today is highlighted with a green border');
para('Test:');
numbered(1, 'Navigate to August 2026 using the < > buttons');
numbered(2, 'Click on August 15 → a modal opens');
numbered(3, 'Pick "National Holiday" leave type, enter "Independence Day"');
numbered(4, 'Save → verify Aug 15 now has a coloured cell on the calendar');
numbered(5, 'Verify the Leave Types panel count incremented for that type');
numbered(6, 'Click Aug 15 again → click "Remove" → verify it is cleared');
numbered(7, 'Click "+ Leave Type" → create a new type "Company Off" with blue colour');
numbered(8, 'Verify it appears in the legend with 0 days');

// 1.4 LOM Config
subheading('1.4 LOM Config');
para('Page: /masters/lom-config');
para('Verify:');
bullet('Calculation Basis = GROSS');
bullet('Multiplier = 1');
bullet('Shift Duration Source = SHIFT_MASTER');
bullet('Grace Minutes Exempt = 15');
bullet('Daily LOM Cap = 240');
para('Test:');
numbered(1, 'Change grace to 20 → Save → verify it persists');
numbered(2, 'Change it back to 15 → Save');

// 1.5 Payroll Workflow Config
subheading('1.5 Payroll Workflow Config');
para('Page: /masters/payroll-workflow-config');
para('Verify:');
bullet('Which optional stages are enabled (VALIDATED / SUBMITTED / POSTED)');
bullet('Approval chain setting (HR Only / Manager-HR / HR-Finance / Manager-HR-Finance)');
para('Test:');
numbered(1, 'Toggle "Enable VALIDATED Stage" on → Save');
numbered(2, 'Go to Salary Processing → verify the pipeline stepper shows the Validated stage');
numbered(3, 'Come back and toggle it off → Save (to keep the default chain)');

// 1.6-1.8
subheading('1.6 OT Plans');
para('Page: /masters/ot-plans');
bullet('Verify: OT plan exists with multiplier, applicable days, settlement options');

subheading('1.7 Comp-Off Policy');
para('Page: /masters/comp-off-policy');
bullet('Verify: Comp-off credit rules, expiry policy, encashment rules');

subheading('1.8 Approval Chain Config');
para('Page: /masters/approval-chain');
bullet('Verify: Shift change approval chain stages (Manager -> HR, etc.)');

// ─── PHASE 2: EMPLOYEE & SALARY ──────────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 2 — Employee & Salary Structure', 18, ACCENT);

subheading('2.1 Employee Master');
para('Page: /employees (or /masters/employees)');
para('Verify:');
bullet('12 active employees visible (RC027-RC037, RC114)');
bullet('76 deactivated employees not shown (or shown as inactive)');
bullet('Each has department, designation, reporting manager');
bullet('oldEmployeeCode matches their biometric device ID');
para('Test:');
numbered(1, 'Open RC027 → verify oldEmployeeCode matches their biometric device ID');
numbered(2, 'Verify reporting manager is set (needed for OT/shift-change approval chain)');
numbered(3, 'Verify salary structure is assigned');
numbered(4, 'Verify department is set');

subheading('2.2 Salary Structure / Salary Details');
para('Page: /masters/salary-structures and per-employee salary details');
para('Verify:');
bullet('Salary components are dynamic (whatever was added in Salary Components page)');
bullet('Each active employee has a salary structure with basic, HRA, allowances, PF, ESI etc.');
para('Test:');
numbered(1, 'Open an employee salary details page');
numbered(2, 'Verify gross, PF rate, ESI rate are set');
numbered(3, 'Verify salary components match what was configured in the Salary Components master');

// ─── PHASE 3: BIOMETRIC & ATTENDANCE ─────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 3 — Biometric & Attendance', 18, ACCENT);

subheading('3.1 Biometric Integration');
para('Page: /workforce/attendance/biometric');
para('Verify:');
bullet('Device controller connection status (on-premise controller)');
bullet('Last sync run timestamp and result');
bullet('Device users listed');
para('Test:');
numbered(1, 'Click "Fetch Attendance" (or Sync)');
numbered(2, 'Select a date range (e.g. 2026-07-01 to 2026-07-31)');
numbered(3, 'Wait for sync to complete');
numbered(4, 'Verify: fetched > 0, created/updated > 0, unmatched = 0');
numbered(5, 'Verify employee matching worked (oldEmployeeCode -> device user ID)');

subheading('3.2 Daily Attendance');
para('Page: /workforce/attendance/daily');
para('Verify:');
bullet('12 employees x 31 days = ~372 records for July 2026');
bullet('Each record shows: inTime, outTime, shift, status (Present/Absent/WeeklyOff/Holiday)');
bullet('isWeeklyOffWorked and isHolidayWorked flags set automatically for Sun/holiday work');
bullet('earlyOutMinutes calculated when checkout is before shift end');
para('Test:');
numbered(1, 'Filter by date 2026-07-26 (Sunday) → verify employees who worked show isWeeklyOffWorked=true');
numbered(2, 'Filter by a weekday → verify isWeeklyOffWorked=false');
numbered(3, 'Look for any record with earlyOutMinutes > 0 → verify it is queued for LOM approval');

subheading('3.3 Monthly Attendance');
para('Page: /workforce/attendance/monthly');
para('Verify: Monthly grid for July 2026 with per-day status colours');
para('Test:');
numbered(1, 'Select July 2026');
numbered(2, 'Click "Finalize"');
numbered(3, 'Verify summary is generated without database errors');

subheading('3.4 Attendance Overview');
para('Page: /workforce/attendance/overview');
bullet('Verify: Department-wise summary, present/absent/late counts');

subheading('3.5 Time Office Final');
para('Page: /workforce/attendance/time-office-final');
bullet('Verify: Consolidated time-office view with OT, LOM, weekly-off, holiday work columns');

// ─── PHASE 4: APPROVALS ─────────────────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 4 — Approvals', 18, ACCENT);

// 4.1 OT Approval
subheading('4.1 OT Approval (Manager -> HR)');
para('Page: /approvals/workforce/overtime');
para('Verify:');
bullet('KPI strip: "Awaiting Manager", "Awaiting HR", "Total Pending OT"');
bullet('Two sections: "Pending My Approval (Reporting Manager)" and "Pending HR Approval"');
bullet('Each row shows employee, date (with Weekly-Off/Holiday tag), OT worked hours');

para('Test A — Single Approve (Manager -> HR):');
numbered(1, 'In the Manager section, click "Approve" on a row');
numbered(2, 'Confirm → the row moves to the HR section');
numbered(3, 'In the HR section, click "Approve" on that row');
numbered(4, 'If it is a Sunday/holiday → a settlement picker appears (Paid OT vs Comp-Off)');
numbered(5, 'Pick "Comp-Off" → verify it is approved');

para('Test B — Bulk Approve:');
numbered(1, 'Select 5+ rows via checkboxes (or "Select all")');
numbered(2, 'Pick settlement type (for HR scope): OT or Comp-Off');
numbered(3, 'Click "Approve selected" → confirm');
numbered(4, 'Verify success message: "Approved X of Y (Z skipped)"');
numbered(5, 'Verify selected rows disappear from the queue');

para('Test C — Reject:');
numbered(1, 'Click "Reject" on a row');
numbered(2, 'Enter rejection reason → submit');
numbered(3, 'Verify the row disappears from the pending queue');

// 4.2 LOM Approval
doc.addPage(); y = 50;
subheading('4.2 LOM Approval');
para('Page: /approvals/workforce/lom');
para('Verify:');
bullet('KPI strip: Pending entries, Pending Late, Pending Early Out, Approved for Deduction');
bullet('Tabs: Pending / Approved / Rejected with counts');
bullet('Each row shows late minutes (amber chip), early-out minutes (red chip), total');

para('Test A — Bulk Approve:');
numbered(1, 'On the "Pending" tab, select a few rows via checkboxes');
numbered(2, 'Click "Approve selected" → confirm');
numbered(3, 'Switch to "Approved" tab → verify the rows appear with "Approved (after grace)" column');
numbered(4, 'Verify the KPI "Approved for Deduction" increased');

para('Test B — Reject:');
numbered(1, 'Click "Reject" on a pending row');
numbered(2, 'Enter rejection reason → submit');
numbered(3, 'Switch to "Rejected" tab → verify the row appears there');

para('Test C — Tab counts:');
numbered(1, 'Verify the Pending tab count matches the number of rows shown');
numbered(2, 'Verify the Approved tab count matches approved rows');
numbered(3, 'Verify the Rejected tab count matches rejected rows');

// 4.3-4.5
subheading('4.3 Mispunch Approval');
para('Page: /approvals/workforce/mispunch');
bullet('Verify: Pending mispunch requests with approve/reject actions');

subheading('4.4 Leave Approval');
para('Page: /approvals/workforce/leave');
bullet('Verify: Pending leave applications with approve/reject');

subheading('4.5 Permission Approval');
para('Page: /approvals/workforce/permission');
bullet('Verify: Pending permission requests (short-duration leave)');

// ─── PHASE 5: SHIFT MANAGEMENT ──────────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 5 — Shift Management', 18, ACCENT);

// 5.1 Shift Plan
subheading('5.1 Shift Plan');
para('Page: /workforce/shift-plan');
para('Verify:');
bullet('KPI strip: Employees Scheduled, Manual Overrides, Night Shift Days');
bullet('Week/Month toggle works');
bullet('Grid with sticky employee column, date columns');
bullet('Today column highlighted in green');
bullet('Weekend columns shaded');
bullet('Each cell shows shift code + time range, colour-coded');
bullet('Override cells have orange outline');
bullet('Legend chips at top showing each shift with its colour');

para('Test A — Single Override:');
numbered(1, 'Click on any cell → a modal opens');
numbered(2, 'Pick a different shift from the tile picker');
numbered(3, 'Enter reason "Testing override"');
numbered(4, 'Click "Save Override"');
numbered(5, 'Verify the cell now has an orange outline and shows the new shift');
numbered(6, 'Hover the cell → an X button appears → click it → override removed');

para('Test B — Navigation:');
numbered(1, 'Click Prev / Next / Today → verify week/month changes');
numbered(2, 'Switch to Month view → verify full month grid renders');
numbered(3, 'Use the employee filter → verify list narrows');

// 5.2 Shift Change Request
doc.addPage(); y = 50;
subheading('5.2 Shift Change Request');
para('Page: /workforce/shift-change-request');
para('Verify:');
bullet('KPI strip: My Requests, Awaiting Approval, Approved, Pending My Action');
bullet('Two sections: "Pending My Approval" and "My Requests"');
bullet('Each row shows from -> to shift chips, status badge with stage number');

para('Test — Create + Full Approval Chain:');
numbered(1, 'Click "+ New Request"');
numbered(2, 'Pick a date (e.g. tomorrow)');
numbered(3, 'Select a target shift (different from current)');
numbered(4, 'Enter reason "Need to change shift for personal reasons"');
numbered(5, 'Submit → verify it appears in "My Requests" with status "pending - stage 1"');
numbered(6, 'Switch to "Pending My Approval" section');
numbered(7, 'Click "Approve" → if multi-stage, approve through each stage');
numbered(8, 'Verify final status = "approved"');
numbered(9, 'Go to Shift Plan → verify a shift override was created for that date');

// 5.3 Shift Notifications
subheading('5.3 Shift Notifications');
para('Page: /workforce/shift-notifications');
para('Verify:');
bullet('KPI strip: Unread, Upcoming Changes, Total Notifications');
bullet('Unread/All filter tabs');
bullet('Notifications grouped by shift date');
bullet('Each shows from -> to shift chips, reason, relative time ("2h ago")');
bullet('Unread notifications have blue background + "New" badge');

para('Test:');
numbered(1, 'After approving a shift change request (Phase 5.2), come here');
numbered(2, 'Verify a new notification appeared for the employee');
numbered(3, 'Click on the unread notification → it marks as read (background turns normal)');
numbered(4, 'Click "Mark all as read" → verify all unread badges clear');
numbered(5, 'Switch to "All" tab → verify both read and unread notifications show');

// 5.4 Bulk Shift Upload
doc.addPage(); y = 50;
subheading('5.4 Bulk Shift Upload');
para('Page: /workforce/bulk-shift-upload');
para('Verify:');
bullet('3-step stepper: Prepare file -> Upload -> Review results');
bullet('File format table showing required columns (employeeCode, date, shiftCode)');
bullet('Drag-and-drop zone');

para('Test:');
numbered(1, 'Click "Download CSV template" → verify file downloads');
numbered(2, 'Edit the CSV with this content:');
code('employeeCode,date,shiftCode');
code('RC027,2026-07-28,GENERAL');
code('RC028,2026-07-28,GENERAL');
code('INVALID,2026-07-28,GENERAL');
code('RC029,2026-07-28,WRONGSHIFT');
numbered(3, 'Drag the file into the upload zone (or click to browse)');
numbered(4, 'Verify file name + size shown in the drop zone');
numbered(5, 'Click "Upload & apply"');
numbered(6, 'Verify result KPIs: 2 created, 2 errors');
numbered(7, 'Switch to "All rows" tab → verify all 4 rows shown with status');
numbered(8, 'Go to Shift Plan → navigate to 2026-07-28 → verify RC027 and RC028 have GENERAL override');
numbered(9, 'Go to Shift Notifications → verify 2 notifications were created for RC027 and RC028');

// ─── PHASE 6: COMP-OFF ──────────────────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 6 — Comp-Off', 18, ACCENT);

subheading('6.1 Comp-Off Request');
para('Page: /workforce/comp-off-request');
para('Verify:');
bullet('KPI strip: Total, Pending, Approved, Rejected');
bullet('All/Pending/Approved/Rejected filter tabs');
bullet('Each request card shows "Worked on -> Comp-off on" date tiles');
bullet('Status badge with dot indicator');

para('Test A — Employee Request:');
numbered(1, 'Click "+ Request Comp-off"');
numbered(2, 'Worked date = 2026-07-26 (Sunday, must have approved OT)');
numbered(3, 'Comp-off date = 2026-08-10');
numbered(4, 'Enter reason "Worked on Sunday for production support"');
numbered(5, 'Submit → verify it appears with status "pending"');

para('Test B — Duplicate Prevention:');
numbered(1, 'Try creating another request for the same worked date (2026-07-26)');
numbered(2, 'Verify it is rejected with "A comp-off request for this worked date already exists"');

para('Test C — HR Approve:');
numbered(1, 'Switch to HR view (if logged in as HR/admin)');
numbered(2, 'Click "Approve" on the pending request');
numbered(3, 'Verify status changes to "approved"');
numbered(4, 'Verify success message: "Comp-off approved — 1 day credited"');

para('Test D — Reject:');
numbered(1, 'Create another request for a different worked date');
numbered(2, 'Click "Reject" → enter reason → submit');
numbered(3, 'Verify status = "rejected" and reason shown on the card');

// ─── PHASE 7: PAYROLL ────────────────────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 7 — Payroll Processing (Full Pipeline)', 18, ACCENT);

subheading('7.1 Salary Processing');
para('Page: /payroll/processing/salary');
para('Verify:');
bullet('PageHeader with period picker (month + year) and status badge');
bullet('Pipeline stepper showing stages reached (Draft -> Calculated -> ... -> Posted)');
bullet('KPI strip: Employees, Total Gross, Total Deductions, Total Net');
bullet('Employee grid with INR formatting, HOLD badges, payslip links');
bullet('Action toolbar changes based on run status');

para('Test A — Full Pipeline on a Fresh Run:');
numbered(1, 'Pick a month with no run yet (e.g. August 2026)');
numbered(2, 'Click "Create Run"');
numbered(3, 'Verify status = DRAFT, stepper shows "Draft" as active');
numbered(4, 'Click "Calculate" → verify "Calculated 12 employee(s)" message');
numbered(5, 'Verify KPIs populate (gross, OT, deductions, net)');
numbered(6, 'Verify grid shows each employee with payable days, gross, net salary');
numbered(7, 'Click "Approve" → status = APPROVED, stepper advances');
numbered(8, 'Click "Lock" → status = LOCKED');
numbered(9, 'If POSTED stage is enabled, click "Post" → status = POSTED');
numbered(10, 'Verify action toolbar shows "This run is locked — no further changes"');

para('Test B — Existing Run (July 2026, Run ID 31):');
numbered(1, 'Navigate to July 2026');
numbered(2, 'Verify status = POSTED (from earlier testing)');
numbered(3, 'Verify all 12 employees have net salary values');
numbered(4, 'Click "View" payslip on any row → verify payslip page opens');

// 7.2-7.3
subheading('7.2 Additions / Deductions');
para('Page: /payroll/processing/additions-deductions?runId=X');
para('Test:');
numbered(1, 'Add a one-time bonus to RC027 → save');
numbered(2, 'Recalculate the run → verify net salary increased for RC027');

subheading('7.3 Bulk Upload Benefits');
para('Page: /payroll/processing/salary/bulk-adhoc?runId=X');
bullet('Verify: CSV upload for canteen/petrol/other benefits works');

// 7.4-7.8
doc.addPage(); y = 50;
subheading('7.4 Payslip (Individual)');
para('Page: /payroll/outputs/payslip?runId=31&lineId=X');
para('Verify:');
bullet('Payslip shows employee name, code, designation');
bullet('Earnings: basic, HRA, allowances, OT, night allowance');
bullet('Deductions: PF, ESI, PT, TDS, LOM, other');
bullet('Gross, total deductions, net salary');
bullet('Pay period, working days, payable days, LOP');
para('Test:');
numbered(1, 'Open payslip for RC027');
numbered(2, 'Verify all sections render');
numbered(3, 'Verify net = gross - deductions');

subheading('7.5 Payslip (Bulk)');
para('Page: /payroll/outputs/payslip-bulk');
bullet('Verify: Can generate payslips for all employees in a run');

subheading('7.6 Bank Transfer File');
para('Page: /payroll/outputs/bank-transfer');
para('Verify:');
bullet('Bank file can be generated from a locked/posted run');
bullet('Shows employee bank account, net salary, IFSC');
para('Test:');
numbered(1, 'Select run 31 (July 2026)');
numbered(2, 'Generate bank file');
numbered(3, 'Verify it downloads (CSV/Excel format)');

subheading('7.7 Payroll Summary');
para('Page: /payroll/outputs/summary');
bullet('Verify: Run-level summary with totals across all employees');

subheading('7.8 Payroll Reconciliation');
para('Page: /payroll/outputs/reconciliation');
bullet('Verify: Reconciliation between attendance, OT, LOM, and payroll amounts');

// ─── PHASE 8: DASHBOARDS ─────────────────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 8 — Dashboards', 18, ACCENT);

subheading('8.1 Payroll Status');
para('Page: /dashboard/payroll-status');
bullet('Verify: Current payroll run status, progress through pipeline');

subheading('8.2 Payroll Processing Status');
para('Page: /dashboard/payroll-processing-status');
bullet('Verify: Detailed processing status with stage timestamps');

subheading('8.3 Attendance Summary');
para('Page: /dashboard/attendance-summary');
bullet('Verify: Monthly attendance overview, present/absent/late trends');

// ─── PHASE 9: EDGE CASES ────────────────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 9 — Edge Cases & Error Handling', 18, ACCENT);

subheading('9.1 Frozen Month Protection');
para('Test:');
numbered(1, 'Try editing attendance for a frozen/finalized month');
numbered(2, 'Verify it is blocked with an error message');

subheading('9.2 Invalid Payroll Transitions');
para('Test:');
numbered(1, 'On a DRAFT run, try to Lock directly (skip Approve) → verify 409 error');
numbered(2, 'On a LOCKED run, try to Calculate again → verify 409 error');
numbered(3, 'On a POSTED run, try any action → verify it is blocked');

subheading('9.3 Permission Enforcement');
para('Test:');
numbered(1, 'Log in as an employee (not HR/admin)');
numbered(2, 'Verify OT Approval page shows only "Pending My Approval" (manager scope), not HR scope');
numbered(3, 'Verify Payroll pages are inaccessible (403)');
numbered(4, 'Verify Comp-off request shows only "My Requests", not all employees');

subheading('9.4 Company Scoping');
para('Test:');
numbered(1, 'If multi-company, switch company context');
numbered(2, 'Verify only that company employees/runs appear');

subheading('9.5 Empty States');
para('Test:');
numbered(1, 'Navigate to a month with no payroll run');
numbered(2, 'Verify friendly empty state with "Create Run" button');

subheading('9.6 Early Check-in Snapping (requires new biometric import)');
para('Test:');
numbered(1, 'Import attendance where an employee checks in 1 hour before shift start');
numbered(2, 'Verify inTime is snapped to shift start (not the actual early punch)');
numbered(3, 'Verify working minutes are not inflated by the early arrival');

subheading('9.7 Auto Weekly-Off / Holiday Detection (requires new biometric import)');
para('Test:');
numbered(1, 'Import attendance for a Sunday where an employee worked');
numbered(2, 'Verify isWeeklyOffWorked = true automatically');
numbered(3, 'Import attendance for a declared holiday → verify isHolidayWorked = true');
numbered(4, 'Import attendance for a regular weekday → verify both flags = false');

subheading('9.8 Early Checkout LOM (requires new biometric import)');
para('Test:');
numbered(1, 'Import attendance where employee checks out 30 min before shift end');
numbered(2, 'Verify earlyOutMinutes = 30 on the daily attendance record');
numbered(3, 'Verify it appears in the LOM Approval queue');
numbered(4, 'Approve it → verify payroll deducts the minutes');
numbered(5, 'Reject another → verify no deduction');

// ─── PHASE 10: QUICK REFERENCE ───────────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 10 — Quick Reference: All Page URLs', 18, ACCENT);

const urls = [
  ['Masters', 'Shift Master', '/masters/shift-masters'],
  ['Masters', 'Departments', '/masters/departments'],
  ['Masters', 'Holiday Master (3 tabs)', '/masters/holidays'],
  ['Masters', 'LOM Config', '/masters/lom-config'],
  ['Masters', 'Payroll Workflow Config', '/masters/payroll-workflow-config'],
  ['Masters', 'OT Plans', '/masters/ot-plans'],
  ['Masters', 'Comp-Off Policy', '/masters/comp-off-policy'],
  ['Masters', 'Approval Chain Config', '/masters/approval-chain'],
  ['Attendance', 'Biometric', '/workforce/attendance/biometric'],
  ['Attendance', 'Daily', '/workforce/attendance/daily'],
  ['Attendance', 'Monthly', '/workforce/attendance/monthly'],
  ['Attendance', 'Overview', '/workforce/attendance/overview'],
  ['Attendance', 'Time Office Final', '/workforce/attendance/time-office-final'],
  ['Approvals', 'OT Approval', '/approvals/workforce/overtime'],
  ['Approvals', 'LOM Approval', '/approvals/workforce/lom'],
  ['Approvals', 'Mispunch', '/approvals/workforce/mispunch'],
  ['Approvals', 'Leave', '/approvals/workforce/leave'],
  ['Approvals', 'Permission', '/approvals/workforce/permission'],
  ['Shift', 'Shift Plan', '/workforce/shift-plan'],
  ['Shift', 'Shift Change Request', '/workforce/shift-change-request'],
  ['Shift', 'Shift Notifications', '/workforce/shift-notifications'],
  ['Shift', 'Bulk Shift Upload', '/workforce/bulk-shift-upload'],
  ['Comp-Off', 'Comp-off Request', '/workforce/comp-off-request'],
  ['Payroll', 'Salary Processing', '/payroll/processing/salary'],
  ['Payroll', 'Payslip (Individual)', '/payroll/outputs/payslip'],
  ['Payroll', 'Payslip (Bulk)', '/payroll/outputs/payslip-bulk'],
  ['Payroll', 'Bank Transfer File', '/payroll/outputs/bank-transfer'],
  ['Payroll', 'Summary', '/payroll/outputs/summary'],
  ['Payroll', 'Reconciliation', '/payroll/outputs/reconciliation'],
  ['Dashboard', 'Payroll Status', '/dashboard/payroll-status'],
  ['Dashboard', 'Payroll Processing', '/dashboard/payroll-processing-status'],
  ['Dashboard', 'Attendance Summary', '/dashboard/attendance-summary'],
];

tableRow(['Category', 'Page', 'URL'], [80, 180, W - 260], true, LIGHT_BG);
urls.forEach(([cat, page, url]) => tableRow([cat, page, url], [80, 180, W - 260]));

// ─── PHASE 11: CHECKLIST ────────────────────────────────────────────────
doc.addPage(); y = 50;
heading('Phase 11 — Test Checklist Summary', 18, ACCENT);
para('Tick each box as you complete the test. Do not skip any phase.');

subheading('Phase 0 — Server');
checkbox('SQL Server is running (Test-NetConnection succeeded)');
checkbox('Next.js dev server is running (npm run dev)');
checkbox('Logged in successfully (hrms-token cookie set)');
checkbox('Quick health check passed (3 pages loaded without errors)');

subheading('Phase 1 — Masters');
checkbox('1.1 Shift Master — viewed and edited');
checkbox('1.2 Departments — verified list');
checkbox('1.3 Holiday Master Tab A — declared holidays CRUD');
checkbox('1.3 Holiday Master Tab B — department weekly-off toggle');
checkbox('1.3 Holiday Master Tab C — yearly leave calendar add/remove');
checkbox('1.4 LOM Config — verified and tested edit');
checkbox('1.5 Payroll Workflow Config — toggled stages');
checkbox('1.6 OT Plans — verified');
checkbox('1.7 Comp-Off Policy — verified');
checkbox('1.8 Approval Chain Config — verified');

subheading('Phase 2 — Employee & Salary');
checkbox('2.1 Employee Master — 12 active, oldEmployeeCode matches biometric');
checkbox('2.2 Salary Structure — components and rates set');

subheading('Phase 3 — Biometric & Attendance');
checkbox('3.1 Biometric — fetched attendance, employees matched');
checkbox('3.2 Daily Attendance — flags auto-set, early-out calculated');
checkbox('3.3 Monthly Attendance — finalized without errors');
checkbox('3.4 Attendance Overview — department summary visible');
checkbox('3.5 Time Office Final — consolidated view visible');

subheading('Phase 4 — Approvals');
checkbox('4.1 OT — single approve (Manager -> HR), bulk approve, reject');
checkbox('4.2 LOM — bulk approve, reject, tab counts correct');
checkbox('4.3 Mispunch — verified');
checkbox('4.4 Leave — verified');
checkbox('4.5 Permission — verified');

subheading('Phase 5 — Shift Management');
checkbox('5.1 Shift Plan — override created and removed, navigation works');
checkbox('5.2 Shift Change Request — full approval chain, override created');
checkbox('5.3 Shift Notifications — unread -> read, mark all read');
checkbox('5.4 Bulk Shift Upload — CSV uploaded, valid + invalid rows handled');

subheading('Phase 6 — Comp-Off');
checkbox('6.1 Comp-Off — request created, duplicate prevented, approved, rejected');

subheading('Phase 7 — Payroll');
checkbox('7.1 Salary Processing — full pipeline (Create -> Calculate -> Approve -> Lock -> Post)');
checkbox('7.2 Additions/Deductions — added and verified');
checkbox('7.3 Bulk Upload Benefits — verified');
checkbox('7.4 Payslip Individual — all sections rendered, net = gross - deductions');
checkbox('7.5 Payslip Bulk — verified');
checkbox('7.6 Bank Transfer File — generated and downloaded');
checkbox('7.7 Payroll Summary — verified');
checkbox('7.8 Payroll Reconciliation — verified');

subheading('Phase 8 — Dashboards');
checkbox('8.1 Payroll Status — verified');
checkbox('8.2 Payroll Processing Status — verified');
checkbox('8.3 Attendance Summary — verified');

subheading('Phase 9 — Edge Cases');
checkbox('9.1 Frozen month protection — blocked');
checkbox('9.2 Invalid payroll transitions — 409 errors');
checkbox('9.3 Permission enforcement — employee role restricted');
checkbox('9.4 Company scoping — verified');
checkbox('9.5 Empty states — friendly message shown');
checkbox('9.6 Early check-in snapping — verified (new import)');
checkbox('9.7 Auto weekly-off/holiday detection — verified (new import)');
checkbox('9.8 Early checkout LOM — verified (new import)');

// ─── END ────────────────────────────────────────────────────────────────
doc.addPage(); y = 50;
doc.rect(0, 0, doc.page.width, doc.page.height).fillColor(DARK).fill();
doc.fillColor('#fff').fontSize(24).font('Helvetica-Bold');
doc.text('Testing Complete!', 50, 250, { width: W, align: 'center' });
doc.fontSize(12).fillColor(ACCENT);
doc.text('All phases tested successfully', 50, 290, { width: W, align: 'center' });
doc.fontSize(9).fillColor('#606870').font('Helvetica');
doc.text('Suki HRMS — Full Manual Test Flow', 50, doc.page.height - 80, { width: W, align: 'center' });

doc.end();
console.log('PDF generated: D:\\HRMS\\Suki-HRMS-Manual-Test-Flow.pdf');
