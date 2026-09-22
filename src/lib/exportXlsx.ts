/**
 * Client-side Excel (.xlsx) export for Learning list pages (BRD §46 — export
 * to Excel). Uses the project's existing `xlsx` dependency — mirrors
 * exportCsv's call signature so pages can offer both formats.
 */

import * as XLSX from 'xlsx';

export function exportXlsx(filename: string, rows: Record<string, unknown>[], sheetName = 'Export'): void {
  if (rows.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}
