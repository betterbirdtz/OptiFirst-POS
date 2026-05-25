import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, ArrowLeft, RefreshCw, Edit2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { DailySalesEntry, DailyStockEntry, DailySummaryEntry, UserSession } from "../../types";
import { formatDateForDisplay, formatDateTimeForDisplay, getLocalDateInputValue } from "../../utils/date";
import { formatCurrency } from "../../utils/calculations";
import { getSessionUser } from "../../utils/session";

export const MyReports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailySummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailSales, setDetailSales] = useState<DailySalesEntry[]>([]);
  const [detailStocks, setDetailStocks] = useState<DailyStockEntry[]>([]);

  const [user] = useState<UserSession | null>(() => getSessionUser());
  const today = getLocalDateInputValue();

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getEmployeeReports(user.employeeId);
      if (response.success && response.reports) {
        const sorted = response.reports.sort((a: DailySummaryEntry, b: DailySummaryEntry) => new Date(b.SubmittedAt).getTime() - new Date(a.SubmittedAt).getTime());
        setReports(sorted);
      } else {
        setError("Failed to load reports.");
      }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetchReports();
  }, [fetchReports, navigate, user]);

  const toggleExpand = async (report: DailySummaryEntry) => {
    if (expandedId === report.ReportID) {
      setExpandedId(null);
      return;
    }
    setExpandedId(report.ReportID);
    setLoadingReportId(report.ReportID);
    try {
      const response = await appsScriptClient.getReportsByDate(report.Date, report.Date, user?.employeeId);
      if (response.success) {
        setDetailSales((response.sales || []).filter((s: DailySalesEntry) => s.ReportID === report.ReportID));
        setDetailStocks((response.stocks || []).filter((s: DailyStockEntry) => s.ReportID === report.ReportID));
      }
    } catch { /* ignore */ }
    finally { setLoadingReportId(null); }
  };

  const handleEdit = (report: DailySummaryEntry) => {
    navigate("/employee/closing", {
      state: {
        resubmitReport: {
          reportId: report.ReportID,
          shopId: report.ShopID,
          date: report.Date.split("T")[0],
          salesEntries: detailSales.map((s) => ({ productId: s.ProductID, productName: s.ProductName, uom: s.UOM, quantity: Number(s.Quantity), rate: Number(s.Rate), saleType: s.SaleType, customerName: s.CustomerName || undefined, efdNumber: s.EFDNumber || undefined })),
          stockEntries: detailStocks.map((s) => ({ productId: s.ProductID, productName: s.ProductName, category: s.Category, uom: s.UOM, openingStock: Number(s.OpeningStock), receipt: Number(s.Receipt), sales: Number(s.Sales), actualClosing: Number(s.ActualClosing) }))
        }
      }
    });
  };

  const canEdit = (report: DailySummaryEntry) => {
    const reportDate = report.Date.split("T")[0];
    return reportDate === today || report.Status === "Reopened";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved": return "bg-green-100 text-green-800 border-green-200";
      case "Rejected": return "bg-red-100 text-red-800 border-red-200";
      case "Reopened": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  return (
    <div className="mx-auto max-w-lg px-3 py-4 pb-28 sm:max-w-4xl sm:px-6 lg:px-8 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/employee/dashboard")} className="p-2 border border-border hover:bg-secondary rounded-lg text-muted-foreground"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="text-xl font-black flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />My Reports</h1>
            <p className="text-xs text-muted-foreground">View full details of all submissions. Edit same-day or reopened reports.</p>
          </div>
        </div>
        <button onClick={fetchReports} disabled={loading} className="p-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5" /><span>{error}</span></div>}

      {loading && reports.length === 0 ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 border-4 border-t-transparent border-primary rounded-full animate-spin"></div></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto opacity-20 mb-3" />
          <p className="text-sm font-medium">No submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.ReportID} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {/* Summary Row - Click to expand */}
              <button type="button" onClick={() => toggleExpand(report)} className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-secondary/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black">{formatDateForDisplay(report.Date)}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getStatusColor(report.Status)}`}>{report.Status}</span>
                    {canEdit(report) && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Editable</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Total: <strong className="text-foreground">{formatCurrency(report.TotalSales)}</strong></span>
                    <span>Cash: <strong className="text-green-700">{formatCurrency(report.CashSales)}</strong></span>
                    <span>Credit: <strong className="text-amber-700">{formatCurrency(report.CreditSales)}</strong></span>
                    <span>Mismatch: <strong className={report.StockMismatch > 0 ? "text-red-700" : "text-green-700"}>{report.StockMismatch}</strong></span>
                  </div>
                </div>
                {expandedId === report.ReportID ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {/* Expanded Detail */}
              {expandedId === report.ReportID && (
                <div className="border-t border-border p-4 space-y-4 bg-secondary/10">
                  {loadingReportId === report.ReportID ? (
                    <div className="flex justify-center py-4"><div className="h-5 w-5 border-2 border-t-transparent border-primary rounded-full animate-spin"></div></div>
                  ) : (
                    <>
                      {/* Sales Detail */}
                      <div>
                        <h4 className="text-xs font-black text-muted-foreground mb-2">Sales Items ({detailSales.length})</h4>
                        {detailSales.length === 0 ? <p className="text-xs text-muted-foreground">No sales entries.</p> : (
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-secondary/50 text-muted-foreground">
                                <tr>
                                  <th className="p-2 font-bold">Product</th>
                                  <th className="p-2 font-bold text-right">Qty</th>
                                  <th className="p-2 font-bold text-right">Rate</th>
                                  <th className="p-2 font-bold">Type</th>
                                  <th className="p-2 font-bold">Customer</th>
                                  <th className="p-2 font-bold text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {detailSales.map((s, i) => (
                                  <tr key={i}>
                                    <td className="p-2 font-semibold">{s.ProductName}</td>
                                    <td className="p-2 text-right">{s.Quantity} {s.UOM}</td>
                                    <td className="p-2 text-right">{formatCurrency(s.Rate)}</td>
                                    <td className={`p-2 font-bold ${s.SaleType === "Cash" ? "text-green-700" : "text-amber-700"}`}>{s.SaleType}</td>
                                    <td className="p-2">{s.CustomerName || "-"}</td>
                                    <td className="p-2 text-right font-black">{formatCurrency(s.TotalAmount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Stock Detail */}
                      <div>
                        <h4 className="text-xs font-black text-muted-foreground mb-2">Stock Entries ({detailStocks.length})</h4>
                        {detailStocks.length === 0 ? <p className="text-xs text-muted-foreground">No stock entries.</p> : (
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-secondary/50 text-muted-foreground">
                                <tr>
                                  <th className="p-2 font-bold">Product</th>
                                  <th className="p-2 font-bold text-right">Opening</th>
                                  <th className="p-2 font-bold text-right">Receipt</th>
                                  <th className="p-2 font-bold text-right">Sales</th>
                                  <th className="p-2 font-bold text-right">Expected</th>
                                  <th className="p-2 font-bold text-right">Actual</th>
                                  <th className="p-2 font-bold text-right">Mismatch</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {detailStocks.map((s, i) => (
                                  <tr key={i}>
                                    <td className="p-2 font-semibold">{s.ProductName}</td>
                                    <td className="p-2 text-right">{s.OpeningStock}</td>
                                    <td className="p-2 text-right">{s.Receipt}</td>
                                    <td className="p-2 text-right">{s.Sales}</td>
                                    <td className="p-2 text-right">{s.ExpectedClosing}</td>
                                    <td className="p-2 text-right font-bold">{s.ActualClosing}</td>
                                    <td className={`p-2 text-right font-black ${Number(s.Mismatch) === 0 ? "text-green-700" : "text-red-700"}`}>{Number(s.Mismatch) === 0 ? "✓" : s.Mismatch}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Submitted info */}
                      <div className="text-xs text-muted-foreground">Submitted: {formatDateTimeForDisplay(report.SubmittedAt)}</div>

                      {/* Edit button */}
                      {canEdit(report) && (
                        <div className="flex justify-end pt-2 border-t border-border">
                          <button onClick={() => handleEdit(report)} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90">
                            <Edit2 className="h-3.5 w-3.5" /> Edit & Resubmit
                          </button>
                        </div>
                      )}
                    </>
                  )}
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
