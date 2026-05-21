import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, RefreshCw, Edit2, AlertCircle } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { DailySalesEntry, DailyStockEntry, DailySummaryEntry, UserSession } from "../../types";
import { formatDateForDisplay, formatDateTimeForDisplay } from "../../utils/date";
import { formatCurrency } from "../../utils/calculations";
import { getSessionUser } from "../../utils/session";

export const MyReports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailySummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [user] = useState<UserSession | null>(() => getSessionUser());

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getEmployeeReports(user.employeeId);
      if (response.success && response.reports) {
        // Sort reports by date descending
        const sorted = response.reports.sort((a: DailySummaryEntry, b: DailySummaryEntry) => {
          return new Date(b.SubmittedAt).getTime() - new Date(a.SubmittedAt).getTime();
        });
        setReports(sorted);
      } else {
        setError("Failed to load reports. Try again.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error loading reports.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchReports();
  }, [fetchReports, navigate, user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "Rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "Reopened":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return <Clock className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/40";
      case "Rejected":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/40";
      case "Reopened":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/40";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/40";
    }
  };

  // Resubmit Flow: Fetch full details and send to wizard
  const handleEditAndResubmit = async (report: DailySummaryEntry) => {
    if (!user) return;
    setLoadingReportId(report.ReportID);
    setError("");
    try {
      // Fetch details by report date and employee
      const response = await appsScriptClient.getReportsByDate(report.Date, report.Date, user.employeeId);
      
      if (response.success) {
        // Filter lines matching our ReportID
        const salesRows = (response.sales || []).filter((sale: DailySalesEntry) => sale.ReportID === report.ReportID);
        const stockRows = (response.stocks || []).filter((stock: DailyStockEntry) => stock.ReportID === report.ReportID);

        // Map them back to the state format required by TodayReport wizard
        const mappedSales = salesRows.map((sale) => ({
          productId: sale.ProductID,
          productName: sale.ProductName,
          uom: sale.UOM,
          quantity: Number(sale.Quantity),
          rate: Number(sale.Rate),
          saleType: sale.SaleType,
          customerName: sale.CustomerName || undefined,
          efdNumber: sale.EFDNumber || undefined
        }));

        const mappedStock = stockRows.map((stock) => ({
          productId: stock.ProductID,
          productName: stock.ProductName,
          category: stock.Category,
          uom: stock.UOM,
          openingStock: Number(stock.OpeningStock),
          receipt: Number(stock.Receipt),
          sales: Number(stock.Sales),
          actualClosing: Number(stock.ActualClosing)
        }));

        // Navigate to wizard and pass this state
        navigate("/employee/today-report", { 
          state: { 
            resubmitReport: {
              reportId: report.ReportID,
              date: report.Date.split("T")[0],
              salesEntries: mappedSales,
              stockEntries: mappedStock
            } 
          } 
        });
      } else {
        setError("Failed to download report items for resubmission.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error while trying to fetch report details.");
    } finally {
      setLoadingReportId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate("/employee/dashboard")}
            className="p-2 border border-border hover:bg-secondary rounded-lg text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center space-x-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <span>My Submitted Reports</span>
            </h1>
            <p className="text-xs text-muted-foreground">Historical list of your submissions</p>
          </div>
        </div>
        
        <button
          onClick={fetchReports}
          disabled={loading}
          className="p-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center space-x-2 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive border border-destructive/20">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reports List */}
      {loading && reports.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-t-transparent border-primary rounded-full animate-spin"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto opacity-20 mb-3" />
          <p className="font-medium text-sm">No submissions recorded yet.</p>
          <p className="text-xs mt-1">Submit your first report from the Dashboard.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div 
              key={report.ReportID} 
              className="bg-card border border-border hover:border-border/100 rounded-2xl p-5 shadow-sm space-y-4 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Report ID: {report.ReportID}</span>
                  <h3 className="text-base font-bold">
                    {formatDateForDisplay(report.Date)}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Submitted: {formatDateTimeForDisplay(report.SubmittedAt)}</p>
                </div>
                <span className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(report.Status)}`}>
                  {getStatusIcon(report.Status)}
                  <span>{report.Status}</span>
                </span>
              </div>

              {/* Data Summary Grid */}
              <div className="grid grid-cols-3 gap-2 bg-secondary/30 p-3 rounded-xl text-center text-xs">
                <div>
                  <p className="text-muted-foreground font-semibold">Total Sales</p>
                  <p className="font-extrabold text-foreground mt-0.5">{formatCurrency(report.TotalSales)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold">Cash Sales</p>
                  <p className="font-bold text-foreground mt-0.5">{formatCurrency(report.CashSales)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold">Credit Sales</p>
                  <p className="font-bold text-foreground mt-0.5">{formatCurrency(report.CreditSales)}</p>
                </div>
              </div>

              {/* Mismatch Count Info */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Stock Mismatches:</span>
                <span className={`font-semibold ${report.StockMismatch > 0 ? "text-destructive" : "text-green-600"}`}>
                  {report.StockMismatch} products
                </span>
              </div>

              {/* Edit/Resubmit Action for Reopened reports */}
              {report.Status === "Reopened" && (
                <div className="border-t border-border/50 pt-3 flex justify-end">
                  <button
                    onClick={() => handleEditAndResubmit(report)}
                    disabled={loadingReportId === report.ReportID}
                    className="flex items-center space-x-1.5 py-1.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-orange-600/10 disabled:opacity-50"
                  >
                    {loadingReportId === report.ReportID ? (
                      <>
                        <div className="h-3.5 w-3.5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                        <span>Loading Details...</span>
                      </>
                    ) : (
                      <>
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit & Resubmit</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default MyReports;
