import { buildPdfBuffer } from '../src/lib/serverReportExport';
import fs from 'fs';

// Mock 13,803 rows with a very long SERIAL_NO string without spaces
const rows = [];
for (let i = 0; i < 13803; i++) {
  rows.push({
    id: i,
    toolNo: `TOOL-${i}`,
    serialNo: `SN12345678901234567890|SN12345678901234567890|SN12345678901234567890`,
    name: 'Long Tool Name without spaces but wait it has spaces',
    make: 'MAKE-LONG-STRING-NO-SPACES-BLAHBLAHBLAHBLAH',
    status: 'ACTIVE'
  });
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'toolNo', label: 'Tool No' },
  { key: 'serialNo', label: 'Serial No' },
  { key: 'name', label: 'Name' },
  { key: 'make', label: 'Make' },
  { key: 'status', label: 'Status' },
];

const pdfBuffer = buildPdfBuffer({
  title: 'Test Export',
  columns,
  rows
});

fs.writeFileSync('scratch/test_export.pdf', pdfBuffer);
console.log(`PDF generated. Buffer length: ${pdfBuffer.length}`);
