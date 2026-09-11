/**
 * Attach bundled sample PDFs to existing JDs that have no file yet
 * (title match). Safe to re-run — skips rows that already have jdFileUrl.
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { saveUploadedFile } from '../src/lib/file-storage';

const samples: [string, string][] = [
  ['HR Manager', '01-hr-manager.pdf'],
  ['CNC Operator', '02-cnc-operator.pdf'],
  ['Quality Engineer', '03-quality-engineer.pdf'],
  ['Design Engineer', '04-design-engineer.pdf'],
  ['Accounts Assistant', '05-accounts-assistant.pdf'],
  ['Sales Executive', '06-sales-executive.pdf'],
  ['IT Systems Engineer', '07-it-systems-engineer.pdf'],
  ['Maintenance Assistant Engineer', '08-maintenance-assistant-engineer.pdf'],
  ['Purchase Assistant', '09-purchase-assistant.pdf'],
  ['Stores In-charge', '10-stores-in-charge.pdf'],
];

async function main() {
  const dir = path.join(process.cwd(), 'public/templates/jd-samples');
  let attached = 0;
  for (const [title, file] of samples) {
    const rows = await prisma.jobDescription.findMany({
      where: { deletedAt: null, jdFileUrl: null, title },
      select: { id: true, jdCode: true },
    });
    if (rows.length === 0) continue;
    const buffer = await readFile(path.join(dir, file));
    for (const row of rows) {
      const jdFileUrl = await saveUploadedFile(buffer, `jd-master/${row.id}`, file);
      await prisma.jobDescription.update({ where: { id: row.id }, data: { jdFileUrl } });
      attached += 1;
      console.log(`Attached ${file} to ${row.jdCode}`);
    }
  }
  console.log(`Done. Attached ${attached} file(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
