import type {
  CreditSalesEntry,
  DailySalesEntry,
  DailyStockEntry,
  DailySummaryEntry,
  EmployeeSummaryRow,
  ReportBundle
} from "../types";

export const emptyReportBundle: ReportBundle = {
  summaries: [],
  sales: [],
  stocks: [],
  creditSales: []
};

export function normalizeReportBundle(response: unknown): ReportBundle {
  const payload = response as Partial<ReportBundle> | null;
  return {
    summaries: Array.isArray(payload?.summaries) ? payload.summaries : [],
    sales: Array.isArray(payload?.sales) ? payload.sales : [],
    stocks: Array.isArray(payload?.stocks) ? payload.stocks : [],
    creditSales: Array.isArray(payload?.creditSales) ? payload.creditSales : []
  };
}

export function getSalesTotals(sales: DailySalesEntry[]) {
  return sales.reduce(
    (totals, sale) => {
      totals.quantity += Number(sale.Quantity || 0);
      totals.cash += Number(sale.CashSales || 0);
      totals.credit += Number(sale.CreditSales || 0);
      totals.total += Number(sale.TotalAmount || 0);
      return totals;
    },
    { quantity: 0, cash: 0, credit: 0, total: 0 }
  );
}

export function getStockTotals(stocks: DailyStockEntry[]) {
  return stocks.reduce(
    (totals, stock) => {
      const mismatch = Number(stock.Mismatch || 0);
      totals.mismatchCount += mismatch !== 0 ? 1 : 0;
      totals.mismatchUnits += mismatch;
      return totals;
    },
    { mismatchCount: 0, mismatchUnits: 0 }
  );
}

export function getCreditTotal(creditSales: CreditSalesEntry[]): number {
  return creditSales.reduce((sum, row) => sum + Number(row.Amount || 0), 0);
}

export function getEmployeeSummary(summaries: DailySummaryEntry[]): EmployeeSummaryRow[] {
  const summaryMap = new Map<string, EmployeeSummaryRow>();

  summaries.forEach((summary) => {
    const key = summary.EmployeeID;
    const existing = summaryMap.get(key) || {
      EmployeeID: summary.EmployeeID,
      EmployeeName: summary.EmployeeName,
      Reports: 0,
      TotalSales: 0,
      CashSales: 0,
      CreditSales: 0,
      StockMismatch: 0
    };

    existing.Reports += 1;
    existing.TotalSales += Number(summary.TotalSales || 0);
    existing.CashSales += Number(summary.CashSales || 0);
    existing.CreditSales += Number(summary.CreditSales || 0);
    existing.StockMismatch += Number(summary.StockMismatch || 0);
    summaryMap.set(key, existing);
  });

  return Array.from(summaryMap.values()).sort((a, b) => b.TotalSales - a.TotalSales);
}

export function getStockMismatches(stocks: DailyStockEntry[]): DailyStockEntry[] {
  return stocks.filter((stock) => Number(stock.Mismatch || 0) !== 0);
}

export function buildReportFilename(title: string, startDate?: string, endDate?: string): string {
  const cleanTitle = title.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  const range = [startDate, endDate].filter(Boolean).join("_to_") || "all_dates";
  return `${cleanTitle}_${range}`;
}
