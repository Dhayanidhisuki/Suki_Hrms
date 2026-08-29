import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import StatCard from "@/components/dashboard/StatCard";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import LeaveApplications from "@/components/dashboard/LeaveApplications";
import NoticeBoard from "@/components/dashboard/NoticeBoard";
import AwardTable from "@/components/dashboard/AwardTable";
import { stats } from "@/components/dashboard/data";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hrms-token");

  if (!token) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
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
