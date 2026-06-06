import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  Check,
  Eye,
  FileCheck,
  FileDown,
  FileSpreadsheet,
  Info,
  RefreshCw,
  ShoppingBag,
  X
} from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import EmployeeSummary from "../../components/admin/EmployeeSummary";
import ReportFilters from "../../components/admin/ReportFilters";
import Modal from "../../components/common/Modal";
import type { DailySalesEntry, DailyStockEntry, DailySummaryEntry, Employee, ReportBundle, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, formatDateTimeForDisplay, getLocalDateInputValue } from "../../utils/date";
import { exportReportWorkbook } from "../../utils/exportExcel";
import { exportSectionsToPdf } from "../../utils/exportPdf";
import { buildReportFilename, getEmployeeSummary, normalizeReportBundle } from "../../utils/reportTransforms";
import { getSessionUser } from "../../utils/session";

interface LocationState {
  highlightReportId?: string;
}

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const today = getLocalDateInputValue();
  const [user] = useState<UserSession | null>(() => getSessionUser());

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bundle, setBundle] = useState<ReportBundle>({ summaries: [], sales: [], stocks: [], creditSales: [] });
  const [selectedReport, setSelectedReport] = useState<DailySummaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const employeeSummaryRows = useMemo(() => getEmployeeSummary(bundle.summaries), [bundle.summaries]);
  const selectedSales = useMemo(
    () => (selectedReport ? bundle.sales.filter((sale) => sale.ReportID === selectedReport.ReportID) : []),
    [bundle.sales, selectedReport]
  );
  const selectedStocks = useMemo(
    () => (selectedReport ? bundle.stocks.filter((stock) => stock.ReportID === selectedReport.ReportID) : []),
    [bundle.stocks, selectedReport]
  );

  const loadEmployees = useCallback(async () => {
    const response = await appsScriptClient.getEmployees();
    if (response.success && response.employees) setEmployees(response.employees);
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getReportsByDate(
        startDate || undefined,
        endDate || undefined,
        selectedEmployeeId || undefined
      );
      if (response.success) {
        const nextBundle = normalizeReportBundle(response);
        nextBundle.summaries = [...nextBundle.summaries].sort(
          (a, b) => new Date(b.SubmittedAt).getTime() - new Date(a.SubmittedAt).getTime()
        );
        setBundle(nextBundle);

        const state = location.state as LocationState | null;
        if (state?.highlightReportId) {
          const highlighted = nextBundle.summaries.find((summary) => summary.ReportID === state.highlightReportId);
          if (highlighted) setSelectedReport(highlighted);
          window.history.replaceState({}, document.title);
        }
      } else {
        setError(response.error || "Failed to load reports.");
      }
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading reports.");
    } finally {
      setLoading(false);
    }
  }, [endDate, location.state, selectedEmployeeId, startDate]);

  useEffect(() => {
    if (!user || user.role !== "Admin") {
      navigate("/login");
      return;
    }
    loadEmployees();
  }, [loadEmployees, navigate, user]);

  useEffect(() => {
    if (user?.role === "Admin") loadReports();
  }, [user, loadReports]);

  const updateStatus = async (reportId: string, action: "approve" | "reject" | "reopen") => {
    if (!user) return;
    setActionLoading(true);
    try {
      const response =
        action === "approve"
          ? await appsScriptClient.approveReport(reportId, user.employeeId)
          : action === "reject"
            ? await appsScriptClient.rejectReport(reportId, user.employeeId)
            : await appsScriptClient.reopenReport(reportId, user.employeeId);

      if (response.success) {
        setSelectedReport(null);
        await loadReports();
      } else {
        setError(response.error || "Report status update failed.");
      }
    } catch (statusError) {
      console.error(statusError);
      setError("Network error updating report status.");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-400";
      case "Rejected":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400";
      case "Reopened":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400";
    }
  };

  const handleExcelExport = () => {
    exportReportWorkbook(bundle, buildReportFilename("All_Report_Data", startDate, endDate));
  };

  const handlePdfExport = () => {
    exportSectionsToPdf({
      title: "Reports and Approvals",
      filename: buildReportFilename("All_Report_Data", startDate, endDate),
      startDate,
      endDate,
      generatedBy: user?.name,
      sections: [
        {
          title: "Summary",
          headers: ["Date", "Employee", "Cash", "Credit", "Total", "Mismatch", "Status"],
          rows: bundle.summaries.map((row) => [
            formatDateForDisplay(row.Date),
            row.EmployeeName,
            formatCurrency(row.CashSales),
            formatCurrency(row.CreditSales),
            formatCurrency(row.TotalSales),
            row.StockMismatch,
            row.Status
          ])
        },
        {
          title: "Daily Sales",
          headers: ["Date", "Shop", "Product", "Qty", "Type", "Total"],
          rows: bundle.sales.map((row) => [
            formatDateForDisplay(row.Date),
            row.ShopName,
            row.ProductName,
            row.Quantity,
            row.SaleType,
            formatCurrency(row.TotalAmount)
          ])
        },
        {
          title: "Daily Stock",
          headers: ["Date", "Shop", "Product", "Expected", "Actual", "Mismatch"],
          rows: bundle.stocks.map((row) => [
            formatDateForDisplay(row.Date),
            row.ShopName,
            row.ProductName,
            row.ExpectedClosing,
            row.ActualClosing,
            row.Mismatch
          ])
        }
      ]
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black">
            <FileCheck className="h-5 w-5 text-primary" />
            Reports and Approvals
          </h1>
          <p className="text-xs text-muted-foreground">View submitted reports. Click "Inspect" to see details and Approve / Reject / Reopen.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadReports}
            disabled={loading}
            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-secondary disabled:opacity-50"
            aria-label="Refresh reports"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleExcelExport}
            disabled={bundle.summaries.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export All Excel
          </button>
          <button
            onClick={handlePdfExport}
            disabled={bundle.summaries.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Export PDF
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

      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      <EmployeeSummary rows={employeeSummaryRows} />

      {loading ? (
        <div className="py-12 text-center text-sm font-semibold text-muted-foreground">Loading report queue...</div>
      ) : bundle.summaries.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          No submitted reports match the selected filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
                  <th className="p-3 font-bold">Date</th>
                  <th className="p-3 font-bold">Employee</th>
                  <th className="p-3 font-bold text-right">Cash</th>
                  <th className="p-3 font-bold text-right">Credit</th>
                  <th className="p-3 font-bold text-right">Total</th>
                  <th className="p-3 font-bold text-right">Mismatch</th>
                  <th className="p-3 font-bold">Submitted</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {bundle.summaries.map((summary) => (
                  <tr key={summary.ReportID} className="hover:bg-secondary/35">
                    <td className="p-3 font-bold">{formatDateForDisplay(summary.Date)}</td>
                    <td className="p-3">{summary.EmployeeName}</td>
                    <td className="p-3 text-right">{formatCurrency(summary.CashSales)}</td>
                    <td className="p-3 text-right">{formatCurrency(summary.CreditSales)}</td>
                    <td className="p-3 text-right font-black text-primary">{formatCurrency(summary.TotalSales)}</td>
                    <td className="p-3 text-right font-bold">{summary.StockMismatch}</td>
                    <td className="p-3 text-muted-foreground">{formatDateTimeForDisplay(summary.SubmittedAt)}</td>
                    <td className="p-3">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${getStatusColor(summary.Status)}`}>
                        {summary.Status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {(summary.Status === "Submitted" || summary.Status === "Pending Approval") && (
                          <>
                            <button
                              onClick={() => updateStatus(summary.ReportID, "approve")}
                              className="rounded-md bg-green-600 p-1.5 text-white hover:bg-green-700"
                              title="Approve"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => updateStatus(summary.ReportID, "reject")}
                              className="rounded-md bg-red-600 p-1.5 text-white hover:bg-red-700"
                              title="Reject"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedReport(summary)}
                          className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary"
                          title="View details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={selectedReport !== null}
        onClose={() => setSelectedReport(null)}
        title={selectedReport ? `Inspect ${formatDateForDisplay(selectedReport.Date)}` : "Inspect Report"}
      >
        {selectedReport && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-muted-foreground">Employee</p>
                  <p className="mt-1 font-black">{selectedReport.EmployeeName}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${getStatusColor(selectedReport.Status)}`}>
                  {selectedReport.Status}
                </span>
              </div>
            </div>

            <ReportDetailTable sales={selectedSales} stocks={selectedStocks} />

            <div className="rounded-xl border border-border p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash Sales</span>
                <span className="font-black">{formatCurrency(selectedReport.CashSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit Sales</span>
                <span className="font-black">{formatCurrency(selectedReport.CreditSales)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-primary">
                <span className="font-black">Total Sales</span>
                <span className="font-black">{formatCurrency(selectedReport.TotalSales)}</span>
              </div>
            </div>

            {(selectedReport.Status === "Pending Approval" || selectedReport.Status === "Submitted") ? (
              <div className="grid grid-cols-3 gap-2 border-t border-border pt-4">
                <button
                  onClick={() => updateStatus(selectedReport.ReportID, "reject")}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive/10 py-3 text-xs font-bold text-destructive hover:bg-destructive hover:text-white disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
                <button
                  onClick={() => updateStatus(selectedReport.ReportID, "reopen")}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-amber-500/10 py-3 text-xs font-bold text-amber-700 hover:bg-amber-500 hover:text-white disabled:opacity-50"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Reopen
                </button>
                <button
                  onClick={() => updateStatus(selectedReport.ReportID, "approve")}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-green-600 py-3 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex items-center gap-2 rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 text-primary" />
                  This report is currently {selectedReport.Status}.
                </div>
                {selectedReport.Status !== "Reopened" && (
                  <button
                    onClick={() => updateStatus(selectedReport.ReportID, "reopen")}
                    disabled={actionLoading}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-secondary disabled:opacity-50"
                  >
                    Reopen
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

interface ReportDetailTableProps {
  sales: DailySalesEntry[];
  stocks: DailyStockEntry[];
}

const ReportDetailTable: React.FC<ReportDetailTableProps> = ({ sales, stocks }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="flex items-center gap-1 text-xs font-black text-muted-foreground">
          <ShoppingBag className="h-3.5 w-3.5" />
          Sales Lines ({sales.length})
        </h4>
        <div className="max-h-40 overflow-auto rounded-xl border border-border">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="p-2">Product</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2">Type</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sales.map((sale, index) => (
                <tr key={`${sale.ProductID}-${index}`}>
                  <td className="p-2 font-bold">{sale.ProductName}</td>
                  <td className="p-2 text-right">{sale.Quantity} {sale.UOM}</td>
                  <td className="p-2">{sale.SaleType}</td>
                  <td className="p-2 text-right font-black">{formatCurrency(sale.TotalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="flex items-center gap-1 text-xs font-black text-muted-foreground">
          <Boxes className="h-3.5 w-3.5" />
          Stock Lines ({stocks.length})
        </h4>
        <div className="max-h-48 overflow-auto rounded-xl border border-border">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="p-2">Product</th>
                <th className="p-2 text-right">Expected</th>
                <th className="p-2 text-right">Actual</th>
                <th className="p-2 text-right">Mismatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {stocks.map((stock, index) => (
                <tr key={`${stock.ProductID}-${index}`}>
                  <td className="p-2 font-bold">{stock.ProductName}</td>
                  <td className="p-2 text-right">{stock.ExpectedClosing}</td>
                  <td className="p-2 text-right">{stock.ActualClosing}</td>
                  <td className={`p-2 text-right font-black ${stock.Mismatch === 0 ? "text-green-600" : "text-destructive"}`}>
                    {stock.Mismatch > 0 ? "+" : ""}{stock.Mismatch}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
