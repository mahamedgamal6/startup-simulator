import * as XLSX from 'xlsx';

export interface SheetColumn {
  key: string;
  label: string;
}

export interface SheetExportInput {
  fileBase: string;
  sheetName: string;
  columns: SheetColumn[];
  rows: Record<string, string | number>[];
}

const widthsFor = (columns: SheetColumn[]) =>
  columns.map((column) => ({ wch: Math.max(14, column.label.length + 4) }));

export function exportExcel({ fileBase, sheetName, columns, rows }: SheetExportInput): void {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: columns.map((column) => column.label),
  });
  worksheet['!cols'] = widthsFor(columns);
  worksheet['!rtl'] = true;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 30));
  XLSX.writeFile(workbook, `${fileBase}.xlsx`);
}

export function exportCsv({ fileBase, columns, rows }: SheetExportInput): void {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: columns.map((column) => column.label),
  });
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileBase}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadTemplate({
  fileBase,
  sheetName,
  columns,
}: Omit<SheetExportInput, 'rows'>): void {
  const worksheet = XLSX.utils.aoa_to_sheet([columns.map((column) => column.label)]);
  worksheet['!cols'] = widthsFor(columns);
  worksheet['!rtl'] = true;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 30));
  XLSX.writeFile(workbook, `نموذج-${fileBase}.xlsx`);
}

export async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const first = workbook.SheetNames[0];
  if (!first) return [];
  const worksheet = workbook.Sheets[first];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
}
