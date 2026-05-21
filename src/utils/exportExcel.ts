import * as XLSX from "xlsx";
import type { EmployeeSummaryRow, ReportBundle } from "../types";
import { getEmployeeSummary, getStockMismatches } from "./reportTransforms";

type ExportPrimitive = string | number | boolean | Date | null | undefined;
type ExportRow = Record<string, ExportPrimitive>;

function mapRows(data: object[], headers: Record<string, string>): ExportRow[] {
  return data.map((item) => {
    const source = item as ExportRow;
    const row: ExportRow = {};
    Object.entries(headers).forEach(([key, label]) => {
      const value = source[key];
      if (value === undefined) return;

      if (key.toLowerCase().includes("date") || key.toLowerCase().includes("at")) {
        const date = value instanceof Date ? value : new Date(String(value));
        row[label] = Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
        return;
      }

      row[label] = value;
    });
    return row;
  });
}

export function exportToExcel(
  data: object[],
  headers: Record<string, string>,
  filename: string,
  sheetName: string = "Report"
) {
  const worksheet = XLSX.utils.json_to_sheet(mapRows(data, headers));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

function appendSheet(workbook: XLSX.WorkBook, rows: ExportRow[], sheetName: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
}

export function exportReportWorkbook(bundle: ReportBundle, filename: string) {
  const workbook = XLSX.utils.book_new();
  const employeeSummary: EmployeeSummaryRow[] = getEmployeeSummary(bundle.summaries);
  const mismatches = getStockMismatches(bundle.stocks);

  appendSheet(workbook, bundle.summaries as unknown as ExportRow[], "Summary");
  appendSheet(workbook, bundle.sales as unknown as ExportRow[], "DailySales");
  appendSheet(workbook, bundle.stocks as unknown as ExportRow[], "DailyStock");
  appendSheet(workbook, bundle.creditSales as unknown as ExportRow[], "CreditSales");
  appendSheet(workbook, mismatches as unknown as ExportRow[], "StockMismatch");
  appendSheet(workbook, employeeSummary as unknown as ExportRow[], "EmployeeSummary");

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
