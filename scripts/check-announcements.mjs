import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const rows = await prisma.announcement.findMany({
  select: { id: true, companyId: true, title: true, status: true, publishedAt: true, createdByUserId: true },
  orderBy: { id: "asc" },
});
console.log("All announcements:", rows.length);
for (const r of rows) console.log("  id", r.id, "| co", r.companyId, "|", r.status, "|", JSON.stringify(r.title), "|", r.publishedAt);
await prisma.$disconnect();
