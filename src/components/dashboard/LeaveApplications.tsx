import { Avatar, Badge, GhostButton, PanelHeader } from "./Primitives";
import { leaveApplications } from "./data";

export default function LeaveApplications() {
  return (
    <section className="card flex flex-col">
      <PanelHeader title="Leave Application" action={<GhostButton>See Details</GhostButton>} />
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-5 pb-5">
        {leaveApplications.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="flex items-center gap-3 rounded-2xl border p-3"
            style={{ borderColor: "var(--border)" }}
          >
            <Avatar name={item.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                {item.name}
              </p>
              <p className="truncate text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                Reason : {item.reason}
              </p>
            </div>
            <Badge tone={item.status === "Approved" ? "success" : "warning"}>{item.status}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}
