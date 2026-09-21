import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportOptions {
  filename: string;
  data: Record<string, any>[];
  columns?: string[];
  title?: string;
  format: 'csv' | 'excel' | 'pdf';
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(options: Omit<ExportOptions, 'format'>): string {
  const { data, columns } = options;

  if (data.length === 0) return '';

  const keys = columns || Object.keys(data[0]);
  const header = keys.map(k => escapeCSV(k)).join(',');
  const rows = data.map(row =>
    keys.map(key => escapeCSV(row[key])).join(',')
  );

  return [header, ...rows].join('\n');
}

export function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(options: Omit<ExportOptions, 'format'>) {
  const { data, columns, filename, title } = options;

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title || 'Sheet1');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(options: Omit<ExportOptions, 'format'>) {
  const { data, columns, filename, title } = options;

  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  const keys = columns || Object.keys(data[0] || {});

  if (title) {
    doc.setFontSize(14);
    doc.text(title, 15, 15);
  }

  const tableData = data.map(row => keys.map(key => row[key]));

  autoTable(doc, {
    head: [keys],
    body: tableData,
    startY: title ? 25 : 15,
    theme: 'grid',
    margin: 10,
    styles: { cellPadding: 3, fontSize: 10 },
  });

  doc.save(`${filename}.pdf`);
}

export function handleExport(options: ExportOptions) {
  switch (options.format) {
    case 'csv':
      const csv = generateCSV(options);
      downloadFile(csv, `${options.filename}.csv`, 'text/csv;charset=utf-8;');
      break;
    case 'excel':
      exportToExcel(options);
      break;
    case 'pdf':
      exportToPDF(options);
      break;
  }
}
