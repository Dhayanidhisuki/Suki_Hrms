// Static placeholder data for the dashboard template.
// Swap these for Prisma queries when the attendance / leave / award models land.

export type Tone = "success" | "warning" | "danger" | "info";

export const stats = [
  {
    label: "Total Employee",
    value: "26",
    delta: "100%",
    trend: "up" as const,
    tone: "success" as Tone,
    icon: "employee" as const,
    visual: "spark" as const,
    description: "Employee count grew the last 7 days, from 22 to 26",
  },
  {
    label: "Today Presents",
    value: "04",
    delta: "15%",
    trend: "up" as const,
    tone: "success" as Tone,
    icon: "attendance" as const,
    visual: "bars" as const,
    description: "15% of employees are present today (10 out of 26)",
  },
  {
    label: "Today Absents",
    value: "13",
    delta: "50%",
    trend: "up" as const,
    tone: "warning" as Tone,
    icon: "employee" as const,
    visual: "ticks" as const,
    description: "50% of employees are present, leaving 13 absent",
  },
  {
    label: "Today Leave",
    value: "09",
    delta: "35%",
    trend: "down" as const,
    tone: "danger" as Tone,
    icon: "leave" as const,
    visual: "meter" as const,
    description: "35% of employees are on leave today (16 out of 26)",
  },
];

export const attendanceSeries = [
  { label: "Icc", track: 92, present: 0, absent: 0, leave: 0 },
  { label: "Test D...", track: 60, present: 0, absent: 0, leave: 0 },
  { label: "Websit...", track: 76, present: 0, absent: 0, leave: 0 },
  { label: "Depart...", track: 55, present: 22, absent: 0, leave: 0 },
  { label: "Produ...", track: 108, present: 0, absent: 62, leave: 0 },
  { label: "Softw...", track: 108, present: 0, absent: 0, leave: 48 },
  { label: "marke...", track: 52, present: 0, absent: 0, leave: 0 },
  { label: "AI inte...", track: 84, present: 0, absent: 0, leave: 0 },
  { label: "Appa...", track: 70, present: 0, absent: 0, leave: 0 },
];

export const leaveApplications = [
  { name: "Maisha Lucy zamora Fonzales", reason: "Dental surgery", status: "Approved" as const },
  { name: "Jonathan Ibrahim Sheakh", reason: "Personal Leave", status: "Pending" as const },
  { name: "Thomas Goodman", reason: "Family Emergency", status: "Approved" as const },
  { name: "Maisha Lucy zamora Fonzales", reason: "Dental surgery", status: "Approved" as const },
];

export const notices = [
  { title: "Get ready for meeting at 6 pm", tag: "Meeting", date: "22-Aug-26", starred: true },
  { title: "Management Decision", tag: "Immediate Management Meeting", date: "11-Jul-26", starred: false },
  { title: "Quarterly appraisal window opens", tag: "HR Announcement", date: "02-Jul-26", starred: false },
];

export const awards = [
  { id: "01", name: "Honorato Imogene curry", department: "Electrical", award: "Gascapitol", date: "22-08-24" },
  { id: "02", name: "Jonathan Ibrahim Sheakh", department: "Production", award: "Coby Beach", date: "30-11-01" },
  { id: "03", name: "Maisha Lucy zamora Fonzales", department: "Marketing", award: "Star Performer", date: "14-06-26" },
  { id: "04", name: "Thomas Goodman", department: "Software", award: "Best Mentor", date: "05-05-26" },
  { id: "05", name: "Ariana Bethel", department: "Accounts", award: "Perfect Attendance", date: "28-04-26" },
];

export const avatarColors = ["#22b573", "#f0b429", "#3b82f6", "#ef5a3c", "#8b5cf6", "#0ea5e9"];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function avatarColor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 997;
  }
  return avatarColors[hash % avatarColors.length];
}
