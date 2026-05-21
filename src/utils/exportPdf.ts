import { jsPDF } from "jspdf";
import { formatCurrency } from "./calculations";
import { getDateRangeLabel } from "./date";

const COMPANY_NAME = "OptiFirst POS";

export interface PaperReportTotals {
  cashSales?: number;
  creditSales?: number;
  totalAmount?: number;
  mismatchCount?: number;
  creditTotal?: number;
}

export interface PaperReportPdfOptions {
  title: string;
  startDate?: string;
  endDate?: string;
  employeeName?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  filename: string;
  totals?: PaperReportTotals;
  orientation?: "portrait" | "landscape";
}

function renderHeader(doc: jsPDF, options: PaperReportPdfOptions) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(COMPANY_NAME, 14, 16);

  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229);
  doc.text(options.title, 14, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${getDateRangeLabel(options.startDate, options.endDate)}`, 14, 31);
  doc.text(`Employee: ${options.employeeName || "All Employees"}`, 14, 36);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 41);

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(203, 213, 225);
  doc.line(14, 45, pageWidth - 14, 45);
}

function renderTotals(doc: jsPDF, y: number, totals?: PaperReportTotals): number {
  if (!totals) return y;

  const pageWidth = doc.internal.pageSize.getWidth();
  const boxX = pageWidth - 92;
  const currentY = y + 4;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(boxX, currentY, 78, 32, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Totals", boxX + 4, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const lines: string[] = [];
  if (totals.cashSales !== undefined) lines.push(`Cash Sales: ${formatCurrency(totals.cashSales)}`);
  if (totals.creditSales !== undefined) lines.push(`Credit Sales: ${formatCurrency(totals.creditSales)}`);
  if (totals.creditTotal !== undefined) lines.push(`Credit Total: ${formatCurrency(totals.creditTotal)}`);
  if (totals.totalAmount !== undefined) lines.push(`Total Amount: ${formatCurrency(totals.totalAmount)}`);
  if (totals.mismatchCount !== undefined) lines.push(`Stock Mismatch Count: ${totals.mismatchCount}`);

  lines.slice(0, 4).forEach((line, index) => {
    doc.text(line, boxX + 4, currentY + 13 + index * 5);
  });

  return currentY + 40;
}

function renderSignatureSection(doc: jsPDF, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 14;
  const right = pageWidth - 14;
  const sectionY = y + 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Prepared By", left, sectionY);
  doc.text("Checked By", left + 70, sectionY);
  doc.text("Approved By", right - 70, sectionY);

  doc.setDrawColor(148, 163, 184);
  doc.line(left, sectionY + 14, left + 45, sectionY + 14);
  doc.line(left + 70, sectionY + 14, left + 115, sectionY + 14);
  doc.line(right - 70, sectionY + 14, right - 25, sectionY + 14);

  return sectionY + 22;
}

export function exportPaperReportToPdf(options: PaperReportPdfOptions) {
  const doc = new jsPDF({
    orientation: options.orientation || "landscape",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 14;
  const right = pageWidth - 14;
  const tableWidth = right - left;
  const colWidth = tableWidth / options.headers.length;
  let y = 52;

  renderHeader(doc, options);

  const drawTableHeader = () => {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(left, y - 5, tableWidth, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    options.headers.forEach((header, index) => {
      doc.text(String(header), left + index * colWidth + 1.5, y);
    });
    y += 8;
  };

  drawTableHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);

  options.rows.forEach((row) => {
    if (y > pageHeight - 34) {
      doc.addPage();
      renderHeader(doc, options);
      y = 52;
      drawTableHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(left, y + 2, right, y + 2);
    row.forEach((cell, index) => {
      const value = cell === undefined || cell === null ? "" : String(cell);
      const maxChars = Math.max(5, Math.floor(colWidth / 1.45));
      const clipped = value.length > maxChars ? `${value.slice(0, maxChars - 2)}..` : value;
      doc.text(clipped, left + index * colWidth + 1.5, y);
    });
    y += 7;
  });

  y = renderTotals(doc, y, options.totals);
  if (y > pageHeight - 28) {
    doc.addPage();
    renderHeader(doc, options);
    y = 52;
  }
  renderSignatureSection(doc, y);

  doc.save(`${options.filename}.pdf`);
}

export function exportToPdf(
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  filename: string
) {
  exportPaperReportToPdf({
    title,
    headers,
    rows,
    filename,
    orientation: "landscape"
  });
}
