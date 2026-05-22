import * as XLSX from "xlsx";
import type { CollectionEntry, EmployeeSummaryRow, ReportBundle } from "../types";
import { getEmployeeSummary, getStockMismatches } from "./reportTransforms";

type ExportPrimitive = string | number | boolean | Date | null | undefined;
type ExportRow = Record<string, ExportPrimitive>;

function formatWorksheet(worksheet: XLSX.WorkSheet) {
  if (!worksheet || !worksheet["!ref"]) return;

  // 1. Auto-fit columns
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  const colWidths: { wch: number }[] = [];

  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxLen = 10; // Default minimum width
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      if (cell && cell.v !== undefined) {
        let valStr = String(cell.v);
        if (cell.t === "d" && cell.v instanceof Date) {
          valStr = cell.v.toLocaleDateString("en-IN");
        }
        if (valStr.length > maxLen) {
          maxLen = valStr.length;
        }
      }
    }
    colWidths.push({ wch: maxLen + 3 }); // Add padding
  }
  worksheet["!cols"] = colWidths;

  // 2. Format numbers
  for (const key in worksheet) {
    if (key.startsWith("!")) continue;
    const cell = worksheet[key];
    if (!cell) continue;

    const val = cell.v;
    if (typeof val === "number") {
      cell.t = "n";
      cell.z = val % 1 !== 0 ? "#,##0.00" : "#,##0";
    } else if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed !== "" && !isNaN(Number(trimmed))) {
        const numVal = Number(trimmed);
        cell.v = numVal;
        cell.t = "n";
        cell.z = numVal % 1 !== 0 ? "#,##0.00" : "#,##0";
      }
    }
  }
}

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
  formatWorksheet(worksheet);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

function appendSheet(workbook: XLSX.WorkBook, rows: ExportRow[], sheetName: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  formatWorksheet(worksheet);
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
  if (bundle.collections) appendSheet(workbook, bundle.collections as unknown as ExportRow[], "Collections");
  appendSheet(workbook, mismatches as unknown as ExportRow[], "StockMismatch");
  appendSheet(workbook, employeeSummary as unknown as ExportRow[], "EmployeeSummary");

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportCollectionsToExcel(collections: CollectionEntry[], filename: string) {
  exportToExcel(
    collections,
    {
      Date: "Date",
      Day: "Day",
      ShopName: "Shop",
      EmployeeName: "Employee",
      CashSales: "CashSales",
      CreditSales: "CreditSales",
      TotalSales: "TotalSales",
      DepositCash: "DepositCash",
      DepositLIPA: "DepositLIPA",
      Variance: "Variance",
      DepositInBank: "DepositInBank",
      DateOfDeposit: "DateOfDeposit",
      EFDZReport: "EFDZReport",
      SalesVsEFD: "SalesVsEFD",
      Name: "Name",
      Signature: "Signature",
      Status: "Status"
    },
    filename,
    "Collections"
  );
}
