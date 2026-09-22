import {
  Award,
  BadgeIndianRupee,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "./NavIcons";

/**
 * The sidebar renders lucide icons (the Suki design system) while
 * navigation.ts keeps its own `IconName` vocabulary. This is the bridge, so
 * the nav tree never has to know which icon set is in use.
 */
export const NAV_LUCIDE: Partial<Record<IconName, LucideIcon>> = {
  home: LayoutDashboard,
  masters: LayoutGrid,
  employee: Users,
  workforce: Clock,
  payroll: BadgeIndianRupee,
  recruitment: Briefcase,
  learning: GraduationCap,
  award: Award,
  approval: CheckCircle2,
  compliance: ShieldCheck,
  document: FileText,
  reports: BarChart3,
  visitor: IdCard,
  services: Sparkles,
  profile: UserCircle,
  settings: Settings,
  admin: SlidersHorizontal,
};

export function navIcon(name: IconName): LucideIcon {
  return NAV_LUCIDE[name] ?? LayoutGrid;
}
