/**
 * Utility functions for exporting data to XLSX (Excel) format
 */
import * as XLSX from "xlsx";

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  getValue?: (row: T) => string | number | null;
}

export interface SheetData<T = any> {
  sheetName: string;
  data: T[];
  columns: ColumnDef<T>[];
}

export function generateXLSX<T>(
  data: T[],
  columns: ColumnDef<T>[],
  sheetName: string = "Data"
): Blob {
  // Convert data to array of arrays with headers
  const headers = columns.map((col) => col.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      if (col.getValue) {
        return col.getValue(row) ?? "";
      }
      const key = col.key as keyof T;
      const value = row[key];
      return value ?? "";
    })
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Generate a multi-sheet XLSX workbook
 */
export function generateMultiSheetXLSX(sheets: SheetData[]): Blob {
  const workbook = XLSX.utils.book_new();
  
  for (const sheet of sheets) {
    if (sheet.data.length === 0) continue;
    
    const headers = sheet.columns.map((col) => col.header);
    const rows = sheet.data.map((row) =>
      sheet.columns.map((col) => {
        if (col.getValue) {
          return col.getValue(row) ?? "";
        }
        const key = col.key as keyof typeof row;
        const value = row[key];
        return value ?? "";
      })
    );
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // Auto-size columns
    const maxWidth = 50;
    const colWidths = headers.map((header, i) => {
      const maxLen = Math.max(
        header.length,
        ...rows.map(row => String(row[i] ?? '').length)
      );
      return { wch: Math.min(maxLen + 2, maxWidth) };
    });
    worksheet['!cols'] = colWidths;
    
    // Truncate sheet name to 31 chars (Excel limit)
    const safeName = sheet.sheetName.substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  }
  
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadXLSX(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
