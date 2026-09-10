import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyTokenNode } from "@/lib/jwt";
import DashboardStats from "@/components/dashboard/DashboardStats";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import LeaveApplications from "@/components/dashboard/LeaveApplications";
import NoticeBoard from "@/components/dashboard/NoticeBoard";
import AwardTable from "@/components/dashboard/AwardTable";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hrms-token");

  if (!token) {
    redirect("/login");
  }

  // This dashboard is company-scoped
  // — Now fetching real data from the database instead of mock data.
  const payload = verifyTokenNode(token.value);
  if (!payload) {
    redirect("/login");
  }
  if (payload.isSuperAdmin) {
    redirect("/superadmin/companies");
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <section>
        <DashboardStats />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <AttendanceChart />
        <LeaveApplications />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
        <NoticeBoard />
        <AwardTable />
      </section>
    </div>
  );
}
