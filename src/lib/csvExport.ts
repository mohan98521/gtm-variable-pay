/**
 * Utility functions for exporting data to CSV
 */

export function escapeCSVField(field: string | number | boolean | null | undefined): string {
  if (field === null || field === undefined) return "";
  const str = String(field);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV<T>(
  data: T[],
  columns: { key: keyof T | string; header: string; getValue?: (row: T) => string | number | null }[]
): string {
  const headers = columns.map((col) => escapeCSVField(col.header)).join(",");
  
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        if (col.getValue) {
          return escapeCSVField(col.getValue(row));
        }
        const key = col.key as keyof T;
        const value = row[key];
        return escapeCSVField(value as string | number | null);
      })
      .join(",");
  });

  return [headers, ...rows].join("\n");
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
