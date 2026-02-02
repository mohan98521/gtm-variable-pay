/**
 * Utility functions for exporting data to XLSX (Excel) format
 */
import * as XLSX from "xlsx";

export function generateXLSX<T>(
  data: T[],
  columns: { key: keyof T | string; header: string; getValue?: (row: T) => string | number | null }[],
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
