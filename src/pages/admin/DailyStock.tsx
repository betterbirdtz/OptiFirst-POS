import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Boxes, FileDown, FileSpreadsheet, RefreshCw } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import PaperReportHeader from "../../components/admin/PaperReportHeader";
import ReportFilters from "../../components/admin/ReportFilters";
import type { DailyStockEntry, Employee, UserSession } from "../../types";
import { formatDateForDisplay, getDateRangeLabel, getLocalDateInputValue } from "../../utils/date";
import { exportToExcel } from "../../utils/exportExcel";
import { exportPaperReportToPdf } from "../../utils/exportPdf";
import { buildReportFilename, getStockTotals } from "../../utils/reportTransforms";
import { getSessionUser } from "../../utils/session";

export const DailyStock: React.FC = () => {
  const navigate = useNavigate();
  const today = getLocalDateInputValue();
  const [user] = useState<UserSession | null>(() => getSessionUser());

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stocks, setStocks] = useState<DailyStockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedEmployee = employees.find((employee) => employee.EmployeeID === selectedEmployeeId);
  const totals = useMemo(() => getStockTotals(stocks), [stocks]);

  const loadEmployees = useCallback(async () => {
    const response = await appsScriptClient.getEmployees();
    if (response.success && response.employees) setEmployees(response.employees);
  }, []);

  const loadStocks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getReportsByDate(
        startDate || undefined,
        endDate || undefined,
        selectedEmployeeId || undefined
      );
      if (response.success && response.stocks) {
        setStocks(response.stocks);
      } else {
        setError(response.error || "Failed to load stock report.");
      }
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading stock report.");
    } finally {
      setLoading(false);
    }
  }, [endDate, selectedEmployeeId, startDate]);

  useEffect(() => {
    if (!user || user.role !== "Admin") {
      navigate("/login");
      return;
    }
    loadEmployees();
  }, [loadEmployees, navigate, user]);

  useEffect(() => {
    if (user?.role === "Admin") loadStocks();
  }, [user, loadStocks]);

  const handleExcelExport = () => {
    exportToExcel(
      stocks as unknown as Record<string, string | number | boolean | Date | null | undefined>[],
      {
        Date: "Date",
        EmployeeName: "Employee",
        ProductName: "Product",
        Category: "Category",
        UOM: "UOM",
        OpeningStock: "Opening Stock",
        Receipt: "Receipt",
        Sales: "Sales",
        ExpectedClosing: "Expected Closing",
        ActualClosing: "Actual Closing",
        Mismatch: "Mismatch"
      },
      buildReportFilename("Daily_Stock", startDate, endDate),
      "DailyStock"
    );
  };

  const handlePdfExport = () => {
    exportPaperReportToPdf({
      title: "Daily Stock Report",
      startDate,
      endDate,
      employeeName: selectedEmployee?.Name,
      filename: buildReportFilename("Daily_Stock_Report", startDate, endDate),
      headers: ["Date", "Employee", "Product", "Opening", "Receipt", "Sales", "Expected", "Actual", "Mismatch"],
      rows: stocks.map((stock) => [
        formatDateForDisplay(stock.Date),
        stock.EmployeeName,
        stock.ProductName,
        `${stock.OpeningStock} ${stock.UOM}`,
        `${stock.Receipt} ${stock.UOM}`,
        `${stock.Sales} ${stock.UOM}`,
        `${stock.ExpectedClosing} ${stock.UOM}`,
        `${stock.ActualClosing} ${stock.UOM}`,
        `${stock.Mismatch > 0 ? "+" : ""}${stock.Mismatch} ${stock.UOM}`
      ]),
      totals: {
        mismatchCount: totals.mismatchCount
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black">
            <Boxes className="h-5 w-5 text-primary" />
            Daily Stock Report
          </h1>
          <p className="text-xs text-muted-foreground">Paper-style stock report with expected closing and mismatch columns.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadStocks}
            disabled={loading}
            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-secondary disabled:opacity-50"
            aria-label="Refresh stock report"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleExcelExport}
            disabled={stocks.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-secondary disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Excel
          </button>
          <button
            onClick={handlePdfExport}
            disabled={stocks.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <ReportFilters
        startDate={startDate}
        endDate={endDate}
        employeeId={selectedEmployeeId}
        employees={employees}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onEmployeeChange={setSelectedEmployeeId}
      />

      <PaperReportHeader
        title="Daily Stock Report"
        dateLabel={getDateRangeLabel(startDate, endDate)}
        employeeName={selectedEmployee?.Name}
      />

      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="py-12 text-center text-sm font-semibold text-muted-foreground">Loading stock report...</div>
      ) : stocks.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          No stock entries found for the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
                    <th className="p-3 font-bold">Date</th>
                    <th className="p-3 font-bold">Employee</th>
                    <th className="p-3 font-bold">Product</th>
                    <th className="p-3 font-bold text-right">Opening</th>
                    <th className="p-3 font-bold text-right">Receipt</th>
                    <th className="p-3 font-bold text-right">Sales</th>
                    <th className="p-3 font-bold text-right">Expected</th>
                    <th className="p-3 font-bold text-right">Actual</th>
                    <th className="p-3 font-bold text-right">Mismatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {stocks.map((stock, index) => (
                    <tr key={`${stock.ReportID}-${stock.ProductID}-${index}`} className="hover:bg-secondary/35">
                      <td className="p-3 font-semibold">{formatDateForDisplay(stock.Date)}</td>
                      <td className="p-3">{stock.EmployeeName}</td>
                      <td className="p-3 font-bold">{stock.ProductName}</td>
                      <td className="p-3 text-right">{stock.OpeningStock} {stock.UOM}</td>
                      <td className="p-3 text-right">{stock.Receipt} {stock.UOM}</td>
                      <td className="p-3 text-right text-primary">{stock.Sales} {stock.UOM}</td>
                      <td className="p-3 text-right">{stock.ExpectedClosing} {stock.UOM}</td>
                      <td className="p-3 text-right font-bold">{stock.ActualClosing} {stock.UOM}</td>
                      <td className={`p-3 text-right font-black ${stock.Mismatch === 0 ? "text-green-600" : "text-destructive"}`}>
                        {stock.Mismatch > 0 ? "+" : ""}{stock.Mismatch} {stock.UOM}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totals.mismatchCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-destructive dark:border-red-900/40 dark:bg-red-950/20">
              <AlertCircle className="h-4 w-4" />
              {totals.mismatchCount} stock lines have non-zero mismatch.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyStock;
