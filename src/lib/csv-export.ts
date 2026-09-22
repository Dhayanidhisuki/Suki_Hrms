export interface CSVExportOptions {
  filename: string;
  data: Record<string, unknown>[];
  columns?: string[];
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(options: CSVExportOptions): string {
  const { data, columns } = options;

  if (data.length === 0) return '';

  const keys = columns || Object.keys(data[0]);
  const header = keys.map(k => escapeCSV(k)).join(',');
  const rows = data.map(row =>
    keys.map(key => escapeCSV(row[key])).join(',')
  );

  return [header, ...rows].join('\n');
}

export function downloadCSV(options: CSVExportOptions): void {
  const csv = generateCSV(options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', options.filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
