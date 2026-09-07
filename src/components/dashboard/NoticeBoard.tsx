import Icon from "@/components/layout/NavIcons";
import { GhostButton } from "./Primitives";
import { notices } from "./data";

export default function NoticeBoard() {
  return (
    <section className="card flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>
          <Icon name="calendar" size={18} />
        </span>
        <h2 className="text-[17px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Notice
        </h2>
        <span className="ml-auto">
          <GhostButton>See Details</GhostButton>
        </span>
      </div>

      <div className="flex-1 space-y-3 px-5 pb-5">
        {notices.map((notice) => (
          <article
            key={notice.title}
            className="rounded-2xl p-4"
            style={{ background: "var(--surface-muted)" }}
          >
            <div className="flex items-start gap-3">
              <p className="flex-1 text-[13px] font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                {notice.title}
              </p>
              <Icon
                name="star"
                size={17}
                style={{ color: notice.starred ? "var(--accent)" : "var(--foreground-muted)" }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-medium"
                style={{ background: "var(--surface)", color: "var(--foreground-muted)" }}
              >
                {notice.tag}
              </span>
              <span className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                <Icon name="calendar" size={13} />
                {notice.date}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
