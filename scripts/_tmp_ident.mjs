import { createRequire } from "module";
const require = createRequire(new URL("../package.json", import.meta.url).pathname);
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
try {
  const rows = await p.$queryRawUnsafe(`
    SELECT c.name AS col, c.is_identity, i.seed_value, i.increment_value
    FROM sys.columns c
    LEFT JOIN sys.identity_columns i ON c.object_id = i.object_id AND c.column_id = i.column_id
    WHERE c.object_id = OBJECT_ID('TOOLS_TRANS_RECEIVE_FOR_CALIBRATION')
      AND c.name IN ('ROW_ID','REC_NO','DC_NO')
  `);
  console.log("LINE TABLE", rows);
  const hdr = await p.$queryRawUnsafe(`
    SELECT c.name AS col, c.is_identity
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('TOOLS_RECEIVE_FOR_CALIBRATION')
      AND c.name IN ('REC_NO','DC_NO','ROW_ID')
  `);
  console.log("HEADER TABLE", hdr);
} finally {
  await p.$disconnect();
}
