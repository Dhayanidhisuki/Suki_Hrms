const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const KEEP_CODES = ['RC027','RC028','RC029','RC030','RC031','RC032','RC033','RC034','RC035','RC036','RC037','RC114'];

(async () => {
  const keepEmps = await p.employee.findMany({ where: { employeeCode: { in: KEEP_CODES } }, select: { id: true } });
  const keepIds = keepEmps.map(e => e.id);
  const allEmps = await p.employee.findMany({ select: { id: true } });
  const removeIds = allEmps.filter(e => !keepIds.includes(e.id)).map(e => e.id);
  const idList = removeIds.join(',');
  console.log(`Remove: ${removeIds.length} employees`);

  // Find all FK constraints referencing Employee
  console.log('\n=== FK constraints referencing Employee table ===');
  const fks = await p.$queryRaw`
    SELECT 
      OBJECT_NAME(fkc.parent_object_id) AS referencing_table,
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS referencing_column,
      fk.name AS constraint_name,
      fk.delete_referential_action_desc AS on_delete
    FROM sys.foreign_key_columns fkc
    JOIN sys.foreign_keys fk ON fkc.constraint_object_id = fk.object_id
    WHERE OBJECT_NAME(fkc.referenced_object_id) = 'Employee'
    ORDER BY referencing_table
  `;
  fks.forEach(f => console.log(`  ${f.referencing_table}.${f.referencing_column}  (${f.constraint_name}, onDelete=${f.on_delete})`));

  // For each referencing table, count rows for removeIds
  console.log('\n=== Row counts in referencing tables ===');
  const tableSet = new Set();
  for (const f of fks) {
    const key = `${f.referencing_table}.${f.referencing_column}`;
    if (tableSet.has(key)) continue;
    tableSet.add(key);
    try {
      const rows = await p.$queryRawUnsafe(
        `SELECT COUNT(*) AS cnt FROM [${f.referencing_table}] WHERE [${f.referencing_column}] IN (${idList})`
      );
      const cnt = Number(rows[0].cnt);
      if (cnt > 0) console.log(`  ${f.referencing_table.padEnd(35)} ${f.referencing_column.padEnd(15)} ${cnt} rows`);
    } catch (e) {
      console.log(`  ${f.referencing_table.padEnd(35)} ${f.referencing_column.padEnd(15)} ERROR: ${e.message.split('\n')[0]}`);
    }
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
