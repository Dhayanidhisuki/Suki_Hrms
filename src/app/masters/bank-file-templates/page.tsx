'use client';

import SlabPage from '@/components/SlabPage';
import type { Column, FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. HDFC-RTGS' },
  { name: 'name', label: 'Template Name', type: 'text', required: true, placeholder: 'e.g. HDFC RTGS Format' },
  { name: 'bankName', label: 'Bank Name', type: 'text', required: true, placeholder: 'e.g. HDFC Bank' },
  { name: 'fileFormat', label: 'File Format', type: 'select', required: true, defaultValue: 'CSV', options: [
    { label: 'CSV', value: 'CSV' },
    { label: 'XLSX', value: 'XLSX' },
    { label: 'TXT', value: 'TXT' },
    { label: 'Fixed Width', value: 'FIXED_WIDTH' },
  ] },
  { name: 'delimiter', label: 'Delimiter', type: 'text', defaultValue: ',', helpText: 'Column separator (for CSV/TXT)' },
  { name: 'columnMapping', label: 'Column Mapping (JSON)', type: 'textarea', required: true, placeholder: '[{"field":"employeeCode","label":"Employee ID"},{"field":"netSalary","label":"Amount"}]', helpText: 'JSON array of column definitions' },
  { name: 'headerRow', label: 'Include Header Row', type: 'checkbox', defaultValue: true },
  { name: 'footerRow', label: 'Include Footer Row', type: 'checkbox', defaultValue: false },
  { name: 'footerTemplate', label: 'Footer Template', type: 'textarea', helpText: 'Footer row template (e.g. total count and amount)' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

interface BankFileTemplateRow {
  id: number;
  code: string;
  name: string;
  bankName: string;
  fileFormat: string;
  delimiter: string;
  columnMapping: string;
  headerRow: boolean;
  footerRow: boolean;
  footerTemplate: string | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  [key: string]: unknown;
}

const columns: Column<BankFileTemplateRow>[] = [
  { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'name', label: 'Name' },
  { key: 'bankName', label: 'Bank' },
  { key: 'fileFormat', label: 'Format' },
];

export default function BankFileTemplatesPage() {
  return (
    <SlabPage<BankFileTemplateRow>
      statsModule="bank-file-templates"
      title="Bank File Templates"
      apiPath="/api/masters/bank-file-templates"
      fields={fields}
      columns={columns}
      itemLabel="Bank File Template"
    />
  );
}
