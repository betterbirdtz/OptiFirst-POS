import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Boxes, ClipboardList, Download, RefreshCw, ShoppingBag, WalletCards } from "lucide-react";
import * as XLSX from "xlsx";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { CollectionEntry, DailySalesEntry, DailyStockEntry, Shop, User, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

export const EmployeeData: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [shopId, setShopId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState(getLocalDateInputValue());
  const [endDate, setEndDate] = useState(getLocalDateInputValue());

  const [sales, setSales] = useState<DailySalesEntry[]>([]);
  const [stocks, setStocks] = useState<DailyStockEntry[]>([]);
  const [collections, setCollections] = useState<CollectionEntry[]>([]);
  const [mtns, setMtns] = useState<Array<{ MTNNo: string; MTNDate: string; From: string; ToShopName: string; ProductName: string; QtyAsPerMTN: number; QtyReceived: number; Variance: number; Status: string; Complaint: string }>>([]);

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "Admin") { navigate("/login"); return; }
    const load = async () => {
      const [shopRes, empRes] = await Promise.all([appsScriptClient.getShops(), appsScriptClient.getEmployees()]);
      if (shopRes.success && shopRes.shops) setShops(shopRes.shops.filter((s) => s.Status === "Active"));
      if (empRes.success && empRes.employees) setEmployees(empRes.employees.filter((e) => e.Role === "Employee"));
    };
    load();
  }, [navigate, user]);

  const loadData = useCallback(async () => {
    setLoading(true); setError(""); setLoaded(false);
    try {
      const [salesRes, stockRes, collRes, mtnRes] = await Promise.all([
        appsScriptClient.getDailySalesReport({ shopId: shopId || undefined, startDate, endDate }),
        appsScriptClient.getDailyStockReport({ shopId: shopId || undefined, startDate, endDate }),
        appsScriptClient.getCollections({ shopId: shopId || undefined, startDate, endDate }),
        appsScriptClient.getMTNsForShop(shopId || "")
      ]);

      let filteredSales = salesRes.sales || [];
      let filteredStocks = stockRes.stocks || [];
      let filteredCollections = collRes.collections || [];
      let filteredMtns = (mtnRes as any).mtns || [];

      if (employeeId) {
        filteredSales = filteredSales.filter((s) => s.EmployeeID === employeeId);
        filteredStocks = filteredStocks.filter((s) => s.EmployeeID === employeeId);
        filteredCollections = filteredCollections.filter((c) => c.EmployeeID === employeeId);
        filteredMtns = filteredMtns.filter((m: any) => m.EmployeeID === employeeId);
      }

      setSales(filteredSales);
      setStocks(filteredStocks);
      setCollections(filteredCollections);
      setMtns(filteredMtns);
      setLoaded(true);
    } catch { setError("Failed to load data."); }
    finally { setLoading(false); }
  }, [shopId, employeeId, startDate, endDate]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (sales.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sales.map((s) => ({
        Date: formatDateForDisplay(s.Date), Shop: s.ShopName, Employee: s.EmployeeName, Product: s.ProductName, Qty: s.Quantity, UOM: s.UOM, Rate: s.Rate, Type: s.SaleType, Customer: s.CustomerName, Cash: s.CashSales, Credit: s.CreditSales, Total: s.TotalAmount
      }))), "Daily Sales");
    }
    if (stocks.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stocks.map((s) => ({
        Date: formatDateForDisplay(s.Date), Shop: s.ShopName, Employee: s.EmployeeName, Product: s.ProductName, Opening: s.OpeningStock, Receipt: s.Receipt, Sales: s.Sales, Expected: s.ExpectedClosing, Actual: s.ActualClosing, Mismatch: s.Mismatch
      }))), "Stock Closing");
    }
    if (collections.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(collections.map((c) => ({
        Date: formatDateForDisplay(c.Date), Day: c.Day, Shop: c.ShopName, Employee: c.EmployeeName, CashSales: c.CashSales, CreditSales: c.CreditSales, Total: c.TotalSales, DepositCash: c.DepositCash, DepositLIPA: c.DepositLIPA, Variance: c.Variance, Bank: c.DepositInBank, EFD: c.EFDZReport, SalesVsEFD: c.SalesVsEFD, Status: c.Status
      }))), "Collection");
    }
    if (mtns.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mtns.map((m) => ({
        MTNNo: m.MTNNo, Date: m.MTNDate, From: m.From, To: m.ToShopName, Product: m.ProductName, Sent: m.QtyAsPerMTN, Received: m.QtyReceived, Variance: m.Variance, Status: m.Status, Complaint: m.Complaint
      }))), "MTN Receipt");
    }
    XLSX.writeFile(wb, `Employee_Data_${startDate}_to_${endDate}.xlsx`);
  };

  const totalSales = sales.reduce((s, r) => s + Number(r.TotalAmount || 0), 0);
  const totalMismatch = stocks.filter((s) => Number(s.Mismatch) !== 0).length;
  const totalVariance = collections.reduce((s, r) => s + Number(r.Variance || 0), 0);

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">Employee Data Report</h1>
          <p className="text-xs text-muted-foreground">View all employee submissions — Sales, Stock, Collection, MTN — in one place.</p>
        </div>
        {loaded && (sales.length > 0 || stocks.length > 0 || collections.length > 0 || mtns.length > 0) && (
          <button onClick={exportExcel} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            <Download className="h-4 w-4" /> Export Excel
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <select value={shopId} onChange={(e) => setShopId(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold">
          <option value="">All Shops</option>
          {shops.map((s) => <option key={s.ShopID} value={s.ShopID}>{s.ShopName}</option>)}
        </select>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold">
          <option value="">All Employees</option>
          {employees.map((e) => <option key={e.UserID} value={e.UserID}>{e.Name}</option>)}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold" />
        <button onClick={loadData} disabled={loading} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Load
        </button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5" />{error}</div>}

      {!loaded ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">Select filters and click Load to view employee data.</div>
      ) : (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Sales</p>
              <p className="mt-1 text-lg font-black text-primary">{formatCurrency(totalSales)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Sales Entries</p>
              <p className="mt-1 text-lg font-black">{sales.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Stock Mismatch</p>
              <p className={`mt-1 text-lg font-black ${totalMismatch > 0 ? "text-red-700" : "text-green-700"}`}>{totalMismatch}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Collection Variance</p>
              <p className={`mt-1 text-lg font-black ${totalVariance !== 0 ? "text-red-700" : "text-green-700"}`}>{formatCurrency(totalVariance)}</p>
            </div>
          </div>

          {/* Daily Sales */}
          <section className="rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border p-4"><ShoppingBag className="h-4 w-4 text-primary" /><h2 className="text-sm font-black">Daily Sales ({sales.length})</h2></div>
            {sales.length === 0 ? <div className="p-6 text-center text-xs text-muted-foreground">No sales data.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                    <tr><th className="p-3">Date</th><th className="p-3">Shop</th><th className="p-3">Employee</th><th className="p-3">Product</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3">Type</th><th className="p-3">Customer</th><th className="p-3 text-right">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sales.slice(0, 50).map((s, i) => (
                      <tr key={i} className="hover:bg-secondary/20">
                        <td className="p-3 font-semibold">{formatDateForDisplay(s.Date)}</td>
                        <td className="p-3">{s.ShopName}</td>
                        <td className="p-3">{s.EmployeeName}</td>
                        <td className="p-3 font-bold">{s.ProductName}</td>
                        <td className="p-3 text-right">{s.Quantity}</td>
                        <td className="p-3 text-right">{formatCurrency(s.Rate)}</td>
                        <td className={`p-3 font-bold ${s.SaleType === "Cash" ? "text-green-700" : "text-amber-700"}`}>{s.SaleType}</td>
                        <td className="p-3">{s.CustomerName || "-"}</td>
                        <td className="p-3 text-right font-black">{formatCurrency(s.TotalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sales.length > 50 && <p className="p-3 text-center text-xs text-muted-foreground">Showing 50 of {sales.length}. Download Excel for full data.</p>}
              </div>
            )}
          </section>

          {/* Stock Closing */}
          <section className="rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border p-4"><Boxes className="h-4 w-4 text-primary" /><h2 className="text-sm font-black">Stock Closing ({stocks.length})</h2></div>
            {stocks.length === 0 ? <div className="p-6 text-center text-xs text-muted-foreground">No stock data.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                    <tr><th className="p-3">Date</th><th className="p-3">Shop</th><th className="p-3">Employee</th><th className="p-3">Product</th><th className="p-3 text-right">Opening</th><th className="p-3 text-right">Receipt</th><th className="p-3 text-right">Sales</th><th className="p-3 text-right">Expected</th><th className="p-3 text-right">Actual</th><th className="p-3 text-right">Mismatch</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {stocks.slice(0, 50).map((s, i) => (
                      <tr key={i} className="hover:bg-secondary/20">
                        <td className="p-3 font-semibold">{formatDateForDisplay(s.Date)}</td>
                        <td className="p-3">{s.ShopName}</td>
                        <td className="p-3">{s.EmployeeName}</td>
                        <td className="p-3 font-bold">{s.ProductName}</td>
                        <td className="p-3 text-right">{s.OpeningStock}</td>
                        <td className="p-3 text-right">{s.Receipt}</td>
                        <td className="p-3 text-right">{s.Sales}</td>
                        <td className="p-3 text-right">{s.ExpectedClosing}</td>
                        <td className="p-3 text-right font-bold">{s.ActualClosing}</td>
                        <td className={`p-3 text-right font-black ${Number(s.Mismatch) === 0 ? "text-green-700" : "text-red-700"}`}>{Number(s.Mismatch) === 0 ? "✓" : s.Mismatch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stocks.length > 50 && <p className="p-3 text-center text-xs text-muted-foreground">Showing 50 of {stocks.length}. Download Excel for full data.</p>}
              </div>
            )}
          </section>

          {/* Collection */}
          <section className="rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border p-4"><WalletCards className="h-4 w-4 text-primary" /><h2 className="text-sm font-black">Collection ({collections.length})</h2></div>
            {collections.length === 0 ? <div className="p-6 text-center text-xs text-muted-foreground">No collection data.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                    <tr><th className="p-3">Date</th><th className="p-3">Shop</th><th className="p-3">Employee</th><th className="p-3 text-right">Cash Sales</th><th className="p-3 text-right">Deposit Cash</th><th className="p-3 text-right">LIPA</th><th className="p-3 text-right">Variance</th><th className="p-3 text-right">Bank</th><th className="p-3 text-right">EFD</th><th className="p-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {collections.slice(0, 50).map((c, i) => (
                      <tr key={i} className="hover:bg-secondary/20">
                        <td className="p-3 font-semibold">{formatDateForDisplay(c.Date)}</td>
                        <td className="p-3">{c.ShopName}</td>
                        <td className="p-3">{c.EmployeeName}</td>
                        <td className="p-3 text-right">{formatCurrency(c.CashSales)}</td>
                        <td className="p-3 text-right">{formatCurrency(c.DepositCash)}</td>
                        <td className="p-3 text-right">{formatCurrency(c.DepositLIPA)}</td>
                        <td className={`p-3 text-right font-black ${c.Variance === 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(c.Variance)}</td>
                        <td className="p-3 text-right">{formatCurrency(c.DepositInBank)}</td>
                        <td className="p-3 text-right">{formatCurrency(c.EFDZReport)}</td>
                        <td className="p-3"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${c.Status === "Approved" ? "border-green-200 bg-green-50 text-green-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{c.Status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {collections.length > 50 && <p className="p-3 text-center text-xs text-muted-foreground">Showing 50 of {collections.length}. Download Excel for full data.</p>}
              </div>
            )}
          </section>

          {/* MTN Receipt */}
          <section className="rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border p-4"><ClipboardList className="h-4 w-4 text-primary" /><h2 className="text-sm font-black">MTN Receipt ({mtns.length})</h2></div>
            {mtns.length === 0 ? <div className="p-6 text-center text-xs text-muted-foreground">No MTN data.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                    <tr><th className="p-3">MTN No</th><th className="p-3">Date</th><th className="p-3">From</th><th className="p-3">To</th><th className="p-3">Product</th><th className="p-3 text-right">Sent</th><th className="p-3 text-right">Received</th><th className="p-3 text-right">Variance</th><th className="p-3">Status</th><th className="p-3">Complaint</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {mtns.slice(0, 50).map((m, i) => (
                      <tr key={i} className="hover:bg-secondary/20">
                        <td className="p-3 font-bold">{m.MTNNo}</td>
                        <td className="p-3">{formatDateForDisplay(m.MTNDate)}</td>
                        <td className="p-3">{m.From}</td>
                        <td className="p-3">{m.ToShopName}</td>
                        <td className="p-3 font-semibold">{m.ProductName}</td>
                        <td className="p-3 text-right">{Number(m.QtyAsPerMTN)}</td>
                        <td className="p-3 text-right font-bold">{Number(m.QtyReceived) || "-"}</td>
                        <td className={`p-3 text-right font-black ${Number(m.Variance) === 0 ? "text-green-700" : "text-red-700"}`}>{Number(m.QtyReceived) > 0 ? (Number(m.Variance) === 0 ? "✓" : m.Variance) : "-"}</td>
                        <td className="p-3"><span className={`text-[10px] font-bold ${String(m.Status).toLowerCase() === "received" ? "text-green-700" : "text-amber-700"}`}>{m.Status || "Sent"}</span></td>
                        <td className="p-3 text-muted-foreground max-w-[150px] truncate">{m.Complaint || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mtns.length > 50 && <p className="p-3 text-center text-xs text-muted-foreground">Showing 50 of {mtns.length}. Download Excel for full data.</p>}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default EmployeeData;
