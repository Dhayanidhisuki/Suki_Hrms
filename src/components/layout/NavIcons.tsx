export type IconName =
  | "home"
  | "attendance"
  | "award"
  | "employee"
  | "department"
  | "leave"
  | "loan"
  | "project"
  | "recruitment"
  | "reports"
  | "reward"
  | "settings"
  | "chevron"
  | "search"
  | "bell"
  | "message"
  | "menu"
  | "calendar"
  | "video"
  | "star"
  | "filter"
  | "export"
  | "trend-up"
  | "trend-down"
  | "info"
  | "masters"
  | "workforce"
  | "payroll"
  | "learning"
  | "visitor"
  | "document"
  | "approval"
  | "ess"
  | "compliance"
  | "admin"
  | "close";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  attendance: <><circle cx="12" cy="8" r="3.2" /><path d="M5 20c.7-3.6 3.5-5.5 7-5.5s6.3 1.9 7 5.5" /></>,
  award: <><circle cx="12" cy="9" r="5" /><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" /></>,
  employee: <><circle cx="9" cy="8" r="3" /><path d="M3 19c.5-3 3-4.6 6-4.6S14.5 16 15 19" /><circle cx="17.5" cy="9.5" r="2.2" /><path d="M16 14.2c2.6.2 4.4 1.8 5 4.8" /></>,
  department: <><path d="M3 21h18" /><path d="M5 21V8l7-4 7 4v13" /><path d="M10 21v-5h4v5" /><path d="M9 11h.01M15 11h.01" /></>,
  leave: <><path d="M2.5 15.5 21 8.5a2 2 0 0 0-1.4-3.7L4.6 9.2" /><path d="M9 11.5 6 8 3.5 8.8 6.2 12.5" /><path d="M4 20h16" /></>,
  loan: <><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><path d="M2.5 10h19" /><path d="M6 14.5h4" /></>,
  project: <><path d="M9 6h12M9 12h12M9 18h12" /><path d="m3 6 1.3 1.3L7 4.6" /><path d="m3 12 1.3 1.3L7 10.6" /><path d="m3 18 1.3 1.3L7 16.6" /></>,
  recruitment: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M3 12h18" /></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  reward: <><path d="m12 3 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8L6.8 19.3l1-5.9L3.5 9.2l5.9-.8z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 16.5 5l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 13 18 8" /><path d="M13.7 18.5a2 2 0 0 1-3.4 0" /></>,
  message: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" /><path d="M9 11h.01M12 11h.01M15 11h.01" /></>,
  menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  video: <><rect x="2.5" y="6.5" width="13" height="11" rx="2.5" /><path d="m16 11 5.5-3v8L16 13z" /></>,
  star: <path d="m12 3 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8L6.8 19.3l1-5.9L3.5 9.2l5.9-.8z" />,
  filter: <><path d="M3 5h18l-7 8v6l-4 2v-8z" /></>,
  export: <><path d="M12 15V3" /><path d="m8 7 4-4 4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  "trend-up": <><path d="m4 16 5-5 3.5 3.5L20 7" /><path d="M15 7h5v5" /></>,
  "trend-down": <><path d="m4 8 5 5 3.5-3.5L20 17" /><path d="M15 17h5v-5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  masters: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" /></>,
  workforce: <><circle cx="12" cy="12" r="9" /><path d="M12 6.8V12l3.4 2" /></>,
  payroll: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></>,
  learning: <><path d="M3.5 5.6A2.6 2.6 0 0 1 6.1 3H20v13.4H6.1a2.6 2.6 0 0 0-2.6 2.6z" /><path d="M3.5 19a2.6 2.6 0 0 1 2.6-2.6H20V21H6.1A2.6 2.6 0 0 1 3.5 19z" /></>,
  visitor: <><rect x="3.5" y="4" width="17" height="16" rx="2.6" /><circle cx="12" cy="10" r="2.3" /><path d="M8.2 16.6c.6-1.7 2-2.6 3.8-2.6s3.2.9 3.8 2.6" /></>,
  document: <><path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z" /><path d="M13.8 3v5.2H19" /><path d="M8.8 13h6.4M8.8 16.4h4.4" /></>,
  approval: <><circle cx="12" cy="12" r="9" /><path d="m8.2 12.3 2.6 2.6 5-5.2" /></>,
  ess: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="2.9" /><path d="M6.6 18.8c1-2.3 3-3.5 5.4-3.5s4.4 1.2 5.4 3.5" /></>,
  compliance: <><path d="M12 3 4.6 6v5.8c0 4.4 3 7.7 7.4 9.2 4.4-1.5 7.4-4.8 7.4-9.2V6z" /><path d="m9.2 12.2 2 2 3.6-3.8" /></>,
  admin: <><path d="M4 6h8M16.5 6H20M4 12h4.5M13 12h7M4 18h8M16.5 18H20" /><circle cx="14.2" cy="6" r="2.1" /><circle cx="10.7" cy="12" r="2.1" /><circle cx="14.2" cy="18" r="2.1" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

export default function Icon({
  name,
  size = 18,
  strokeWidth = 1.7,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
