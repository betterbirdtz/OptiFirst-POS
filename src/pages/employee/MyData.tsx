import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, RefreshCw, ShoppingBag, Boxes, WalletCards, ClipboardList } from "lucide-react";
import * as XLSX from "xlsx";
import { appsScriptClient } from "../../api/appsScriptClient";
import DateRangeFilter from "../../components/common/DateRangeFilter";
import type { CollectionEntry, DailySalesEntry, DailyStockEntry, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { exportSectionsToPdf } from "../../utils/exportPdf";
import { buildReportFilename } from "../../utils/reportTransforms";
import { getSessionUser } from "../../utils/session";

export const MyData: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [startDate, setStartDate] = useState(getLocalDateInputValue());
  const [endDate, setEndDate] = useState(getLocalDateInputValue());
  const [sales, setSales] = useState<DailySalesEntry[]>([]);
  const [stocks, setStocks] = useState<DailyStockEntry[]>([]);
  const [collections, setCollections] = useState<CollectionEntry[]>([]);
  const [mtns, setMtns] = useState<Array<{ id: string; mtnNo: string; mtnDate: string; from: string; to: string; items: Array<{ itemName: string; quantity: number; rate: number; amount: number }>; complaintNote: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "Employee") { navigate("/admin/dashboard"); return; }
  }, [navigate, user]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [salesRes, stockRes, collRes, mtnRes] = await Promise.all([
        appsScriptClient.getDailySalesReport({ shopId: user.shopId || "", startDate, endDate }),
        appsScriptClient.getDailyStockReport({ shopId: user.shopId || "", startDate, endDate }),
        appsScriptClient.getCollections({ shopId: user.shopId || "", startDate, endDate }),
        appsScriptClient.getMTNsForShop(user.shopId || "")
      ]);
      setSales((salesRes.sales || []).filter((s) => s.EmployeeID === user.employeeId));
      setStocks((stockRes.stocks || []).filter((s) => s.EmployeeID === user.employeeId));
      setCollections((collRes.collections || []).filter((c) => c.EmployeeID === user.employeeId));

      const grouped = new Map<string, typeof mtns[number]>();
      (mtnRes.mtns || [])
        .filter((mtn) => {
          const date = String(mtn.MTNDate).split("T")[0];
          return date >= startDate && date <= endDate;
        })
        .forEach((mtn) => {
          const key = mtn.MTNNo;
          const existing = grouped.get(key) || {
            id: mtn.MTNID,
            mtnNo: mtn.MTNNo,
            mtnDate: String(mtn.MTNDate).split("T")[0],
            from: mtn.From,
            to: mtn.ToShopName,
            items: [],
            complaintNote: mtn.Complaint || ""
          };
          existing.items.push({
            itemName: mtn.ProductName,
            quantity: Number(mtn.QtyReceived || mtn.QtyAsPerMTN || 0),
            rate: 0,
            amount: 0
          });
          if (mtn.Complaint) existing.complaintNote = mtn.Complaint;
          grouped.set(key, existing);
        });
      setMtns(Array.from(grouped.values()));

      setLoaded(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user, startDate, endDate]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (sales.length > 0) {
      const ws = XLSX.utils.json_to_sheet(sales.map((s) => ({
        Date: s.Date, Product: s.ProductName, UOM: s.UOM, Qty: s.Quantity, Rate: s.Rate, Type: s.SaleType, Customer: s.CustomerName, Amount: s.TotalAmount
      })));
      XLSX.utils.book_append_sheet(wb, ws, "Daily Sales");
    }

    if (stocks.length > 0) {
      const ws = XLSX.utils.json_to_sheet(stocks.map((s) => ({
        Date: s.Date, Product: s.ProductName, Opening: s.OpeningStock, Receipt: s.Receipt, Sales: s.Sales, Expected: s.ExpectedClosing, Actual: s.ActualClosing, Mismatch: s.Mismatch
      })));
      XLSX.utils.book_append_sheet(wb, ws, "Stock Closing");
    }

    if (collections.length > 0) {
      const ws = XLSX.utils.json_to_sheet(collections.map((c) => ({
        Date: c.Date, Day: c.Day, CashSales: c.CashSales, CreditSales: c.CreditSales, Total: c.TotalSales, DepositCash: c.DepositCash, DepositLIPA: c.DepositLIPA, Variance: c.Variance, DepositInBank: c.DepositInBank, DateOfDeposit: c.DateOfDeposit, EFDZReport: c.EFDZReport, SalesVsEFD: c.SalesVsEFD, Name: c.Name, Status: c.Status
      })));
      XLSX.utils.book_append_sheet(wb, ws, "Collection");
    }

    if (mtns.length > 0) {
      const rows: Array<Record<string, unknown>> = [];
      mtns.forEach((m) => {
        m.items.forEach((item) => {
          rows.push({ MTNNo: m.mtnNo, Date: m.mtnDate, From: m.from, To: m.to, Item: item.itemName, Qty: item.quantity, Rate: item.rate, Amount: item.amount });
        });
        if (m.complaintNote) rows.push({ MTNNo: m.mtnNo, Date: m.mtnDate, From: "", To: "", Item: "COMPLAINT", Qty: "", Rate: "", Amount: m.complaintNote });
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "MTN");
    }

    XLSX.writeFile(wb, `MyData_${startDate}_to_${endDate}.xlsx`);
  };

  const exportPdf = () => {
    exportSectionsToPdf({
      title: "My Submitted Data",
      filename: buildReportFilename("My_Submitted_Data", startDate, endDate),
      startDate,
      endDate,
      generatedBy: user?.name,
      sections: [
        {
          title: "Daily Sales",
          headers: ["Date", "Product", "Qty", "Type", "Amount"],
          rows: sales.map((row) => [formatDateForDisplay(row.Date), row.ProductName, row.Quantity, row.SaleType, formatCurrency(row.TotalAmount)])
        },
        {
          title: "Stock Closing",
          headers: ["Date", "Product", "Opening", "Sales", "Actual", "Mismatch"],
          rows: stocks.map((row) => [formatDateForDisplay(row.Date), row.ProductName, row.OpeningStock, row.Sales, row.ActualClosing, row.Mismatch])
        },
        {
          title: "Collection",
          headers: ["Date", "Cash", "Credit", "Deposit", "Variance", "Status"],
          rows: collections.map((row) => [formatDateForDisplay(row.Date), formatCurrency(row.CashSales), formatCurrency(row.CreditSales), formatCurrency(row.DepositCash), formatCurrency(row.Variance), row.Status])
        },
        {
          title: "MTN",
          headers: ["MTN", "Date", "From", "To", "Item", "Qty"],
          rows: mtns.flatMap((mtn) => mtn.items.map((item) => [mtn.mtnNo, formatDateForDisplay(mtn.mtnDate), mtn.from, mtn.to, item.itemName, item.quantity]))
        }
      ]
    });
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 px-3 py-4 pb-28 sm:max-w-5xl sm:px-6 sm:py-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/employee/dashboard")} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">My Submitted Data</h1>
          <p className="text-xs text-muted-foreground">View all your submissions and download as Excel or PDF</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <DateRangeFilter startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} compact />
        <div className="flex gap-3">
          <button onClick={loadData} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 active:scale-[0.97]">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Load
          </button>
          {loaded && (sales.length > 0 || stocks.length > 0 || collections.length > 0 || mtns.length > 0) && (
            <button onClick={exportExcel} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-bold active:bg-secondary">
              <Download className="h-4 w-4" /> Excel
            </button>
          )}
          {loaded && (sales.length > 0 || stocks.length > 0 || collections.length > 0 || mtns.length > 0) && (
            <button onClick={exportPdf} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground active:bg-primary/90">
              <Download className="h-4 w-4" /> PDF
            </button>
          )}
        </div>
      </div>

      {!loaded ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">Select date range and click Load to view your data.</div>
      ) : (
        <div className="space-y-5">
          {/* Daily Sales */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black mb-3"><ShoppingBag className="h-4 w-4 text-primary" />Daily Sales ({sales.length} entries)</h2>
            {sales.length === 0 ? <p className="text-xs text-muted-foreground">No sales data for this period.</p> : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 font-bold">Date</th>
                      <th className="p-2 font-bold">Product</th>
                      <th className="p-2 font-bold text-right">Qty</th>
                      <th className="p-2 font-bold text-right">Rate</th>
                      <th className="p-2 font-bold">Type</th>
                      <th className="p-2 font-bold">Customer</th>
                      <th className="p-2 font-bold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sales.map((s, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold">{formatDateForDisplay(s.Date)}</td>
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
          </section>

          {/* Stock Closing */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black mb-3"><Boxes className="h-4 w-4 text-primary" />Stock Closing ({stocks.length} entries)</h2>
            {stocks.length === 0 ? <p className="text-xs text-muted-foreground">No stock data for this period.</p> : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 font-bold">Date</th>
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
                    {stocks.map((s, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold">{formatDateForDisplay(s.Date)}</td>
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
          </section>

          {/* Collection */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black mb-3"><WalletCards className="h-4 w-4 text-primary" />Collection ({collections.length} entries)</h2>
            {collections.length === 0 ? <p className="text-xs text-muted-foreground">No collection data for this period.</p> : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 font-bold">Date</th>
                      <th className="p-2 font-bold text-right">Cash Sales</th>
                      <th className="p-2 font-bold text-right">Credit</th>
                      <th className="p-2 font-bold text-right">Deposit Cash</th>
                      <th className="p-2 font-bold text-right">LIPA</th>
                      <th className="p-2 font-bold text-right">Variance</th>
                      <th className="p-2 font-bold text-right">Bank</th>
                      <th className="p-2 font-bold text-right">EFD</th>
                      <th className="p-2 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {collections.map((c, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold">{formatDateForDisplay(c.Date)}</td>
                        <td className="p-2 text-right">{formatCurrency(c.CashSales)}</td>
                        <td className="p-2 text-right">{formatCurrency(c.CreditSales)}</td>
                        <td className="p-2 text-right">{formatCurrency(c.DepositCash)}</td>
                        <td className="p-2 text-right">{formatCurrency(c.DepositLIPA)}</td>
                        <td className={`p-2 text-right font-black ${c.Variance !== 0 ? "text-red-700" : "text-green-700"}`}>{formatCurrency(c.Variance)}</td>
                        <td className="p-2 text-right">{formatCurrency(c.DepositInBank)}</td>
                        <td className="p-2 text-right">{formatCurrency(c.EFDZReport)}</td>
                        <td className="p-2 font-bold">{c.Status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* MTN */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black mb-3"><ClipboardList className="h-4 w-4 text-primary" />MTN Vouchers ({mtns.length})</h2>
            {mtns.length === 0 ? <p className="text-xs text-muted-foreground">No MTN data for this period.</p> : (
              <div className="space-y-3">
                {mtns.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">{m.mtnNo} · {formatDateForDisplay(m.mtnDate)}</p>
                      <p className="text-xs text-muted-foreground">{m.from} → {m.to}</p>
                    </div>
                    <div className="overflow-x-auto rounded border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-secondary/50 text-muted-foreground">
                          <tr><th className="p-1.5 font-bold">Item</th><th className="p-1.5 font-bold text-right">Qty</th><th className="p-1.5 font-bold text-right">Rate</th><th className="p-1.5 font-bold text-right">Amount</th></tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {m.items.filter((item) => item.quantity > 0).map((item, j) => (
                            <tr key={j}><td className="p-1.5 font-semibold">{item.itemName}</td><td className="p-1.5 text-right">{item.quantity}</td><td className="p-1.5 text-right">{item.rate}</td><td className="p-1.5 text-right font-bold">{item.amount.toLocaleString()}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {m.complaintNote && <p className="text-xs text-red-700 font-semibold">⚠ {m.complaintNote}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default MyData;
