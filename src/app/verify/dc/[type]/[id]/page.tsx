import Image from "next/image";
import { prisma } from "@/lib/prisma";
import {
  type DcVerificationType,
  verifyDcSignature,
} from "@/lib/dcQrUrl";

type PageProps = {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ sig?: string | string[] }>;
};

function formatDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function valueOrDash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function InvalidDc({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-red-100 text-2xl text-red-700">!</div>
        <h1 className="text-2xl text-slate-950">DC verification failed</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </main>
  );
}

export default async function DcVerificationPage({ params, searchParams }: PageProps) {
  const route = await params;
  const query = await searchParams;
  const type = route.type as DcVerificationType;
  const id = decodeURIComponent(route.id).trim();
  const signature = Array.isArray(query.sig) ? query.sig[0] : query.sig;

  if (
    (type !== "movement" && type !== "calibration" && type !== "receive") ||
    !id ||
    !verifyDcSignature(type, id, signature)
  ) {
    return <InvalidDc message="This QR code is invalid or has been altered. Scan the QR printed on the latest DC PDF." />;
  }

  if (type === "receive") {
    const recNo = Number(id);
    if (!Number.isSafeInteger(recNo) || recNo < 1) {
      return <InvalidDc message="The receive DC number is invalid." />;
    }
    const receive = await prisma.toolsIssueReceived.findUnique({
      where: { recNo },
      select: {
        recNo: true,
        dcNo: true,
        receiveDate: true,
        contName: true,
        location: true,
        status: true,
        creatUserIdCd: true,
        issueHeader: { select: { fromUnit: true } },
        lines: {
          orderBy: { rowId: "asc" },
          select: {
            toolOrGaugeNo: true,
            serialNo: true,
            quantity: true,
            status: true,
            tool: { select: { toolOrGaugeNo: true, name: true, description: true, size: true, location: true } },
          },
        },
      },
    });
    if (!receive) return <InvalidDc message={`Receive DC REC-${id} was not found in the system.`} />;

    return (
      <VerificationLayout title="Receive Delivery Challan" dcNo={`REC-${receive.recNo}`} status={receive.status ?? "RECEIVED"}>
        <Details rows={[
          ["Against issue DC", receive.dcNo],
          ["Receive date", formatDate(receive.receiveDate)],
          ["Received from", valueOrDash(receive.contName)],
          ["From unit", valueOrDash(receive.issueHeader.fromUnit)],
          ["Destination / rack", valueOrDash(receive.location)],
          ["Received by", valueOrDash(receive.creatUserIdCd)],
        ]} />
        <LineItems rows={receive.lines.map((line, index) => ({
          index: index + 1,
          number: line.toolOrGaugeNo ?? line.tool?.toolOrGaugeNo ?? "—",
          description: line.tool?.description ?? line.tool?.name,
          size: line.tool?.size,
          location: receive.location ?? line.tool?.location,
          quantity: Number(line.quantity ?? 0),
          status: line.status,
        }))} />
      </VerificationLayout>
    );
  }

  if (type === "movement") {
    const issue = await prisma.gaugeToolsIssue.findUnique({
      where: { dcNo: id },
      select: {
        dcNo: true,
        issueDate: true,
        dueDate: true,
        receiveName: true,
        fromUnit: true,
        issueOption: true,
        issuePurpose: true,
        status: true,
        lines: {
          orderBy: { rowId: "asc" },
          select: {
            toolOrGaugeNo: true,
            partNo: true,
            name: true,
            description: true,
            issueQty: true,
            issueToItemNo: true,
            status: true,
            tool: { select: { name: true, description: true, size: true, location: true } },
            toolByRef: { select: { name: true, description: true, size: true, location: true } },
          },
        },
      },
    });

    if (!issue) return <InvalidDc message={`Movement DC ${id} was not found in the system.`} />;
    const destination = issue.lines.find((line) => line.issueToItemNo)?.issueToItemNo;

    return (
      <VerificationLayout title="Movement Delivery Challan" dcNo={issue.dcNo} status={issue.status}>
        <Details rows={[
          ["Issue date", formatDate(issue.issueDate)],
          ["Expected receipt", formatDate(issue.dueDate)],
          ["Receiver", valueOrDash(issue.receiveName)],
          ["Movement", valueOrDash(issue.issueOption)],
          ["From unit", valueOrDash(issue.fromUnit)],
          ["To unit", valueOrDash(destination)],
          ["Purpose", valueOrDash(issue.issuePurpose)],
        ]} />
        <LineItems rows={issue.lines.map((line, index) => {
          const tool = line.tool ?? line.toolByRef;
          return {
            index: index + 1,
            number: line.toolOrGaugeNo ?? line.partNo,
            description: line.description ?? line.name ?? tool?.description ?? tool?.name,
            size: tool?.size,
            location: tool?.location,
            quantity: Number(line.issueQty ?? 1),
            status: line.status,
          };
        })} />
      </VerificationLayout>
    );
  }

  const dcNo = Number(id);
  if (!Number.isSafeInteger(dcNo) || dcNo < 1) {
    return <InvalidDc message="The calibration DC number is invalid." />;
  }
  const issue = await prisma.toolsIssueForCalibration.findUnique({
    where: { dcNo },
    select: {
      dcNo: true,
      issueDate: true,
      receiveName: true,
      issueFor: true,
      subCode: true,
      receiveHeaders: { select: { recNo: true } },
      inHouseLines: {
        orderBy: { rowId: "asc" },
        select: {
          toolOrGaugeNo: true,
          issueQty: true,
          status: true,
          resultStatus: true,
          dueDate: true,
          tool: { select: { name: true, description: true, size: true, location: true } },
        },
      },
    },
  });
  if (!issue) return <InvalidDc message={`Calibration DC ${id} was not found in the system.`} />;

  const completed = issue.inHouseLines.filter((line) => {
    const result = line.resultStatus?.trim().toUpperCase();
    return Boolean(result && result !== "PENDING");
  }).length;
  const status = issue.receiveHeaders.length > 0 || completed === issue.inHouseLines.length
    ? "CLOSED"
    : completed > 0 ? "PARTIAL" : "OPEN";

  return (
    <VerificationLayout title="Calibration Delivery Challan" dcNo={String(issue.dcNo)} status={status}>
      <Details rows={[
        ["Issue date", formatDate(issue.issueDate)],
        ["Receiver", valueOrDash(issue.receiveName)],
        ["Issue for", valueOrDash(issue.issueFor)],
        ["Agency code", valueOrDash(issue.subCode)],
        ["Line items", String(issue.inHouseLines.length)],
      ]} />
      <LineItems rows={issue.inHouseLines.map((line, index) => ({
        index: index + 1,
        number: valueOrDash(line.toolOrGaugeNo),
        description: line.tool?.description ?? line.tool?.name,
        size: line.tool?.size,
        location: line.tool?.location,
        quantity: Number(line.issueQty ?? 1),
        status: line.resultStatus ?? line.status,
      }))} />
    </VerificationLayout>
  );
}

function VerificationLayout({ title, dcNo, status, children }: {
  title: string;
  dcNo: string;
  status: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 text-slate-900 sm:px-6 sm:py-10">
      <article className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <header className="border-b border-slate-200 bg-slate-950 px-5 py-6 text-white sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <Image src="/logo-blue.svg" alt="SUKI Tools" width={190} height={60} className="h-12 w-auto rounded bg-white px-2" priority />
            <div className="text-left sm:text-right">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Verified live record
              </div>
              <p className="mt-2 text-xs text-slate-400">Fetched securely from Tools Management</p>
            </div>
          </div>
        </header>
        <div className="p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{title}</p>
              <h1 className="mt-1 text-2xl text-slate-950 sm:text-3xl">DC {dcNo}</h1>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">{valueOrDash(status)}</span>
          </div>
          {children}
          <p className="mt-8 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
            This page displays the current record stored in the system. If the printed DC and this page differ, use this live record for verification.
          </p>
        </div>
      </article>
    </main>
  );
}

function Details({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type VerificationLine = {
  index: number;
  number: string;
  description: string | null | undefined;
  size: string | null | undefined;
  location: string | null | undefined;
  quantity: number;
  status: string | null | undefined;
};

function LineItems({ rows }: { rows: VerificationLine[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg text-slate-950">Line items ({rows.length})</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
            <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Tool / Gauge</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Size</th><th className="px-4 py-3">Used location</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr key={`${row.index}-${row.number}`}>
                <td className="px-4 py-3 text-slate-500">{row.index}</td><td className="px-4 py-3 font-semibold">{row.number}</td><td className="px-4 py-3">{valueOrDash(row.description)}</td><td className="px-4 py-3">{valueOrDash(row.size)}</td><td className="px-4 py-3">{valueOrDash(row.location)}</td><td className="px-4 py-3">{row.quantity}</td><td className="px-4 py-3">{valueOrDash(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
