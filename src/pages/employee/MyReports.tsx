import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Boxes, ClipboardList, Download, Edit2, RefreshCw, ShoppingBag, WalletCards } from "lucide-react";
import * as XLSX from "xlsx";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { CollectionEntry, DailySalesEntry, DailyStockEntry, DailySummaryEntry, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

export const MyReports: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [startDate, setStartDate] = useState(getLocalDateInputValue());
  const [endDate, setEndDate] = useState(getLocalDateInputValue());

  const [sales, setSales] = useState<DailySalesEntry[]>([]);
  const [stocks, setStocks] = useState<DailyStockEntry[]>([]);
  const [collections, setCollections] = useState<CollectionEntry[]>([]);
  const [mtns, setMtns] = useState<Array<{ MTNNo: string; MTNDate: string; From: string; ToShopName: string; ProductName: string; QtyAsPerMTN: number; QtyReceived: number; Variance: number; Status: string }>>([]);
  const [reopenedReports, setReopenedReports] = useState<DailySummaryEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(""); setLoaded(false);
    try {
      const shopId = user.shopId || "";
      const [salesRes, stockRes, collRes, mtnRes] = await Promise.all([
        appsScriptClient.getDailySalesReport({ shopId, startDate, endDate }),
        appsScriptClient.getDailyStockReport({ shopId, startDate, endDate }),
        appsScriptClient.getCollections({ shopId, startDate, endDate }),
        appsScriptClient.getMTNsForShop(shopId)
      ]);

      setSales((salesRes.sales || []).filter((s) => s.EmployeeID === user.employeeId));
      setStocks((stockRes.stocks || []).filter((s) => s.EmployeeID === user.employeeId));
      setCollections((collRes.collections || []).filter((c) => c.EmployeeID === user.employeeId));
      setMtns(((mtnRes as any).mtns || []).filter((m: any) => m.EmployeeID === user.employeeId));

      // Load reopened reports that need re-editing
      const reportsRes = await appsScriptClient.getEmployeeReports(user.employeeId);
      if (reportsRes.success && reportsRes.reports) {
        setReopenedReports(reportsRes.reports.filter((r) => r.Status === "Reopened"));
      }

      setLoaded(true);
    } catch { setError("Failed to load data."); }
    finally { setLoading(false); }
  }, [user, startDate, endDate]);

  const handleEditReopened = async (report: DailySummaryEntry) => {
    navigate("/employee/edit-report", {
      state: {
        reportId: report.ReportID,
        shopId: report.ShopID,
        date: String(report.Date).split("T")[0]
      }
    });
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (sales.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sales.map((s) => ({ Date: formatDateForDisplay(s.Date), Product: s.ProductName, Qty: s.Quantity, Rate: s.Rate, Type: s.SaleType, Customer: s.CustomerName, Amount: s.TotalAmount }))), "Sales");
    if (stocks.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stocks.map((s) => ({ Date: formatDateForDisplay(s.Date), Product: s.ProductName, Opening: s.OpeningStock, Receipt: s.Receipt, Sales: s.Sales, Expected: s.ExpectedClosing, Actual: s.ActualClosing, Mismatch: s.Mismatch }))), "Stock");
    if (collections.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(collections.map((c) => ({ Date: formatDateForDisplay(c.Date), CashSales: c.CashSales, DepositCash: c.DepositCash, LIPA: c.DepositLIPA, Variance: c.Variance, Bank: c.DepositInBank, EFD: c.EFDZReport, Status: c.Status }))), "Collection");
    if (mtns.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mtns.map((m) => ({ MTN: m.MTNNo, Date: m.MTNDate, From: m.From, To: m.ToShopName, Product: m.ProductName, Sent: m.QtyAsPerMTN, Received: m.QtyReceived, Variance: m.Variance, Status: m.Status }))), "MTN");
    XLSX.writeFile(wb, `My_Data_${startDate}_to_${endDate}.xlsx`);
  };

  const totalSales = sales.reduce((s, r) => s + Number(r.TotalAmount || 0), 0);
  const totalMismatch = stocks.filter((s) => Number(s.Mismatch) !== 0).length;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-3 py-4 pb-28 sm:max-w-4xl sm:px-6 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/employee/dashboard")} className="rounded-lg border border-border p-2 text-muted-foreground active:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="text-lg font-black">My Submissions</h1>
            <p className="text-[10px] text-muted-foreground">All your sales, stock, collection & MTN data</p>
          </div>
        </div>
        {loaded && (sales.length > 0 || stocks.length > 0) && (
          <button onClick={exportExcel} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground active:bg-primary/90">
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
        )}
      </div>

      {/* Date filter */}
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3">
        <div>
          <label className="mb-1 block text-[10px] font-bold text-muted-foreground">From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold text-muted-foreground">To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
      <button onClick={loadData} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50 active:scale-[0.97]">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "Loading..." : "Load My Data"}
      </button>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5" />{error}</div>}

      {/* Reopened Reports - Need Re-editing */}
      {reopenedReports.length > 0 && (
        <section className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
          <h2 className="text-sm font-black text-orange-800">⚠ Reopened by Admin — Edit Required ({reopenedReports.length})</h2>
          <p className="text-[10px] text-orange-700">Admin has reopened these reports. Tap Edit to correct specific items.</p>
          {reopenedReports.map((report) => (
            <div key={report.ReportID} className="flex items-center justify-between rounded-lg border border-orange-200 bg-white p-3">
              <div>
                <p className="text-sm font-bold">{formatDateForDisplay(report.Date)}</p>
                <p className="text-[10px] text-muted-foreground">Sales: {formatCurrency(report.TotalSales)} · Mismatch: {report.StockMismatch}</p>
              </div>
              <button
                onClick={() => handleEditReopened(report)}
                className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white active:bg-orange-700"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit Items
              </button>
            </div>
          ))}
        </section>
      )}

      {loaded && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Sales</p>
              <p className="mt-1 text-sm font-black text-primary">{formatCurrency(totalSales)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Entries</p>
              <p className="mt-1 text-sm font-black">{sales.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Mismatch</p>
              <p className={`mt-1 text-sm font-black ${totalMismatch > 0 ? "text-red-700" : "text-green-700"}`}>{totalMismatch}</p>
            </div>
          </div>

          {/* Daily Sales */}
          {sales.length > 0 && (
            <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border p-3 bg-green-50"><ShoppingBag className="h-4 w-4 text-green-700" /><h2 className="text-xs font-black text-green-800">Daily Sales ({sales.length})</h2></div>
              <div className="divide-y divide-border/60">
                {sales.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-bold">{s.ProductName}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDateForDisplay(s.Date)} · {s.Quantity} {s.UOM} × {formatCurrency(s.Rate)} · <span className={s.SaleType === "Cash" ? "text-green-700" : "text-amber-700"}>{s.SaleType}</span>{s.CustomerName ? ` · ${s.CustomerName}` : ""}</p>
                    </div>
                    <p className="text-sm font-black">{formatCurrency(s.TotalAmount)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Stock Closing */}
          {stocks.length > 0 && (
            <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border p-3 bg-blue-50"><Boxes className="h-4 w-4 text-blue-700" /><h2 className="text-xs font-black text-blue-800">Stock Closing ({stocks.length})</h2></div>
              <div className="divide-y divide-border/60">
                {stocks.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-bold">{s.ProductName}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDateForDisplay(s.Date)} · Open: {s.OpeningStock} · Sales: {s.Sales} · Actual: {s.ActualClosing}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${Number(s.Mismatch) === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {Number(s.Mismatch) === 0 ? "✓" : `${Number(s.Mismatch) > 0 ? "+" : ""}${s.Mismatch}`}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Collection */}
          {collections.length > 0 && (
            <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border p-3 bg-purple-50"><WalletCards className="h-4 w-4 text-purple-700" /><h2 className="text-xs font-black text-purple-800">Collection ({collections.length})</h2></div>
              <div className="divide-y divide-border/60">
                {collections.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-bold">{formatDateForDisplay(c.Date)}</p>
                      <p className="text-[10px] text-muted-foreground">Cash: {formatCurrency(c.DepositCash)} · LIPA: {formatCurrency(c.DepositLIPA)} · Bank: {formatCurrency(c.DepositInBank)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-black ${c.Variance === 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(c.Variance)}</p>
                      <span className={`text-[9px] font-bold ${c.Status === "Approved" ? "text-green-700" : "text-blue-700"}`}>{c.Status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* MTN */}
          {mtns.length > 0 && (
            <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border p-3 bg-amber-50"><ClipboardList className="h-4 w-4 text-amber-700" /><h2 className="text-xs font-black text-amber-800">MTN Receipt ({mtns.length})</h2></div>
              <div className="divide-y divide-border/60">
                {mtns.map((m, i) => (
                  <div key={i} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-bold">{m.ProductName}</p>
                      <p className="text-[10px] text-muted-foreground">{m.MTNNo} · {m.From} → {m.ToShopName} · Sent: {Number(m.QtyAsPerMTN)} · Received: {Number(m.QtyReceived) || "-"}</p>
                    </div>
                    <span className={`text-[10px] font-black ${String(m.Status).toLowerCase() === "received" ? "text-green-700" : "text-amber-700"}`}>{m.Status || "Sent"}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {sales.length === 0 && stocks.length === 0 && collections.length === 0 && mtns.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-bold text-muted-foreground">No data for this date range</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyReports;
