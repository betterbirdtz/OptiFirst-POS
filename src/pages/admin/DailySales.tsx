import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileDown, FileSpreadsheet, RefreshCw, TrendingUp } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import PaperReportHeader from "../../components/admin/PaperReportHeader";
import ReportFilters from "../../components/admin/ReportFilters";
import type { DailySalesEntry, Employee, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, getDateRangeLabel, getLocalDateInputValue } from "../../utils/date";
import { exportToExcel } from "../../utils/exportExcel";
import { exportPaperReportToPdf } from "../../utils/exportPdf";
import { buildReportFilename, getSalesTotals } from "../../utils/reportTransforms";
import { getSessionUser } from "../../utils/session";

export const DailySales: React.FC = () => {
  const navigate = useNavigate();
  const today = getLocalDateInputValue();
  const [user] = useState<UserSession | null>(() => getSessionUser());

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sales, setSales] = useState<DailySalesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedEmployee = employees.find((employee) => employee.EmployeeID === selectedEmployeeId);
  const totals = useMemo(() => getSalesTotals(sales), [sales]);

  const loadEmployees = useCallback(async () => {
    const response = await appsScriptClient.getEmployees();
    if (response.success && response.employees) setEmployees(response.employees);
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getReportsByDate(
        startDate || undefined,
        endDate || undefined,
        selectedEmployeeId || undefined
      );
      if (response.success && response.sales) {
        setSales(response.sales);
      } else {
        setError(response.error || "Failed to load sales report.");
      }
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading sales report.");
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
    if (user?.role === "Admin") loadSales();
  }, [user, loadSales]);

  const handleExcelExport = () => {
    exportToExcel(
      sales as unknown as Record<string, string | number | boolean | Date | null | undefined>[],
      {
        Date: "Date",
        EmployeeName: "Employee",
        ProductName: "Product",
        UOM: "UOM",
        Quantity: "Quantity",
        Rate: "Rate",
        SaleType: "Sale Type",
        CashSales: "Cash Sales",
        CreditSales: "Credit Sales",
        EFDNumber: "EFD Number",
        CustomerName: "Customer Name",
        TotalAmount: "Total Amount"
      },
      buildReportFilename("Daily_Sales", startDate, endDate),
      "DailySales"
    );
  };

  const handlePdfExport = () => {
    exportPaperReportToPdf({
      title: "Daily Sales Report",
      startDate,
      endDate,
      employeeName: selectedEmployee?.Name,
      filename: buildReportFilename("Daily_Sales_Report", startDate, endDate),
      headers: ["Date", "Employee", "Product", "Qty", "Rate", "Type", "Customer", "Cash", "Credit", "Total"],
      rows: sales.map((sale) => [
        formatDateForDisplay(sale.Date),
        sale.EmployeeName,
        sale.ProductName,
        `${sale.Quantity} ${sale.UOM}`,
        formatCurrency(sale.Rate),
        sale.SaleType,
        sale.CustomerName || "-",
        formatCurrency(sale.CashSales),
        formatCurrency(sale.CreditSales),
        formatCurrency(sale.TotalAmount)
      ]),
      totals: {
        cashSales: totals.cash,
        creditSales: totals.credit,
        totalAmount: totals.total
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black">
            <TrendingUp className="h-5 w-5 text-primary" />
            Daily Sales Report
          </h1>
          <p className="text-xs text-muted-foreground">Paper-style sales report with cash, credit, and grand totals.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadSales}
            disabled={loading}
            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-secondary disabled:opacity-50"
            aria-label="Refresh sales report"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleExcelExport}
            disabled={sales.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-secondary disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Excel
          </button>
          <button
            onClick={handlePdfExport}
            disabled={sales.length === 0}
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
        title="Daily Sales Report"
        dateLabel={getDateRangeLabel(startDate, endDate)}
        employeeName={selectedEmployee?.Name}
      />

      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="py-12 text-center text-sm font-semibold text-muted-foreground">Loading sales report...</div>
      ) : sales.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          No sales entries found for the selected filters.
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
                    <th className="p-3 font-bold text-right">Quantity</th>
                    <th className="p-3 font-bold text-right">Rate</th>
                    <th className="p-3 font-bold">Type</th>
                    <th className="p-3 font-bold">Customer</th>
                    <th className="p-3 font-bold">EFD</th>
                    <th className="p-3 font-bold text-right">Cash</th>
                    <th className="p-3 font-bold text-right">Credit</th>
                    <th className="p-3 font-bold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sales.map((sale, index) => (
                    <tr key={`${sale.ReportID}-${index}`} className="hover:bg-secondary/35">
                      <td className="p-3 font-semibold">{formatDateForDisplay(sale.Date)}</td>
                      <td className="p-3">{sale.EmployeeName}</td>
                      <td className="p-3 font-bold">{sale.ProductName}</td>
                      <td className="p-3 text-right">{sale.Quantity} {sale.UOM}</td>
                      <td className="p-3 text-right">{formatCurrency(sale.Rate)}</td>
                      <td className="p-3">{sale.SaleType}</td>
                      <td className="p-3">{sale.CustomerName || "-"}</td>
                      <td className="p-3 font-mono text-muted-foreground">{sale.EFDNumber || "-"}</td>
                      <td className="p-3 text-right">{formatCurrency(sale.CashSales)}</td>
                      <td className="p-3 text-right">{formatCurrency(sale.CreditSales)}</td>
                      <td className="p-3 text-right font-black text-primary">{formatCurrency(sale.TotalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-bold text-muted-foreground">Total Quantity</p>
              <p className="mt-1 text-lg font-black">{totals.quantity}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-bold text-muted-foreground">Cash Sales</p>
              <p className="mt-1 text-lg font-black text-green-600">{formatCurrency(totals.cash)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-bold text-muted-foreground">Credit Sales</p>
              <p className="mt-1 text-lg font-black text-amber-600">{formatCurrency(totals.credit)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-bold text-muted-foreground">Total Amount</p>
              <p className="mt-1 text-lg font-black text-primary">{formatCurrency(totals.total)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailySales;
