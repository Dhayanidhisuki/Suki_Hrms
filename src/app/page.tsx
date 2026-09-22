import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyTokenNode } from "@/lib/jwt";
import { hasAnyPermission } from "@/lib/rbac";
import OverviewDashboard from "@/components/dashboard/overview/OverviewDashboard";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hrms-token");

  if (!token) {
    redirect("/login");
  }

  const payload = verifyTokenNode(token.value);
  if (!payload) {
    redirect("/login");
  }
  if (payload.isSuperAdmin) {
    redirect("/superadmin/companies");
  }

  // The dashboard below is company-wide HR data — headcount, attendance,
  // payroll, statutory. An ESS-only login (a role holding no permissions at
  // all) has no business seeing any of it, so send them to their own
  // self-service dashboard instead. /api/dashboard/overview enforces the same
  // rule server-side (employees.view); this redirect is what stops the page
  // from rendering an error card at them.
  if (payload.roleId === undefined || !(await hasAnyPermission(payload.roleId))) {
    redirect("/ess/dashboard");
  }

  return <OverviewDashboard />;
}
