import Icon from "@/components/layout/NavIcons";
import { Avatar } from "./Primitives";
import { awards } from "./data";

export default function AwardTable() {
  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-4">
        <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Employee Award List
          <Icon name="info" size={14} style={{ color: "var(--foreground-muted)" }} />
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label
            className="flex h-9 items-center gap-2 rounded-full border px-3"
            style={{ borderColor: "var(--border)" }}
          >
            <Icon name="search" size={15} style={{ color: "var(--foreground-muted)" }} />
            <input
              type="search"
              placeholder="Search"
              className="w-24 bg-transparent text-[12px] outline-none placeholder:text-[color:var(--foreground-muted)] sm:w-32"
              style={{ color: "var(--foreground)" }}
            />
          </label>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] font-medium"
            style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}
          >
            <Icon name="filter" size={15} />
            Filter
          </button>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-full px-4 text-[12px] font-semibold text-white"
            style={{ background: "var(--foreground)" }}
          >
            <Icon name="export" size={15} />
            Export
          </button>
        </div>
      </div>

      <div className="scroll-thin overflow-x-auto px-2 pb-4">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr style={{ color: "var(--foreground-muted)" }}>
              {["SL.", "Image", "Name", "Department Name", "Award Name", "Date"].map((heading) => (
                <th key={heading} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {awards.map((row) => (
              <tr key={row.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-3 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
                  {row.id}
                </td>
                <td className="px-3 py-3">
                  <Avatar name={row.name} size={34} />
                </td>
                <td className="px-3 py-3 text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                  {row.name}
                </td>
                <td className="px-3 py-3 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
                  {row.department}
                </td>
                <td className="px-3 py-3 text-[13px]" style={{ color: "var(--foreground)" }}>
                  <span className="inline-flex items-center gap-2">
                    <Icon name="award" size={15} style={{ color: "var(--warning)" }} />
                    {row.award}
                  </span>
                </td>
                <td className="px-3 py-3 text-[13px]" style={{ color: "var(--foreground-muted)" }}>
                  {row.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
