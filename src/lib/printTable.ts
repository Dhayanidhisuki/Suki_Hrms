/**
 * printTable — reusable print/PDF-friendly export (BRD §46).
 *
 * Opens a minimal print view in a new window containing a styled table of the
 * rows currently shown/filtered on the page, then triggers the browser print
 * dialog (which can save as PDF). No server-side PDF dependency.
 */

export interface PrintColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

export function printTable<T>(title: string, columns: PrintColumn<T>[], rows: T[]) {
  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const header = columns.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${columns.map((c) => `<td>${esc(c.value(r))}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">Exported ${new Date().toLocaleString()} · ${rows.length} row(s)</div>
<table><thead><tr>${header}</tr></thead><tbody>${body || `<tr><td colspan="${columns.length}">No data</td></tr>`}</tbody></table>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
