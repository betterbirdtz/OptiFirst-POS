import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, FileDown, FileSpreadsheet, RefreshCw } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { DailyStockEntry, Shop, User, UserSession } from "../../types";
import { formatDateForDisplay, getDateRangeLabel, getLocalDateInputValue } from "../../utils/date";
import { exportToExcel } from "../../utils/exportExcel";
import { exportPaperReportToPdf } from "../../utils/exportPdf";
import { buildReportFilename, getStockTotals } from "../../utils/reportTransforms";
import { getSessionUser } from "../../utils/session";
import { Filters } from "./DailySales";

export const DailyStock: React.FC = () => {
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [startDate, setStartDate] = useState(getLocalDateInputValue());
  const [endDate, setEndDate] = useState(getLocalDateInputValue());
  const [stocks, setStocks] = useState<DailyStockEntry[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [mtnRows, setMtnRows] = useState<Array<{ MTNNo: string; MTNDate: string; ToShopName: string; ProductName: string; QtyAsPerMTN: number; QtyReceived: number; Variance: number; Status: string; Complaint: string }>>([]);

  const selectedShop = shops.find((shop) => shop.ShopID === shopId);
  const employeeFiltered = employeeId ? stocks.filter((s) => s.EmployeeID === employeeId) : stocks;
  const filteredStocks = mismatchOnly ? employeeFiltered.filter((s) => s.Mismatch !== 0) : employeeFiltered;
  const totals = useMemo(() => getStockTotals(employeeFiltered), [employeeFiltered]);

  // Mismatch grouped by employee
  const mismatchByEmployee = useMemo(() => {
    const map = new Map<string, { name: string; count: number; items: DailyStockEntry[] }>();
    employeeFiltered.filter((s) => s.Mismatch !== 0).forEach((s) => {
      const key = s.EmployeeID;
      const existing = map.get(key) || { name: s.EmployeeName || s.EmployeeID, count: 0, items: [] };
      existing.count++;
      existing.items.push(s);
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [employeeFiltered]);

  // MTN mismatches (from employee MTN receipts)
  const mtnMismatches = useMemo(() => {
    return mtnRows
      .map((row) => ({
        mtnNo: row.MTNNo,
        date: String(row.MTNDate).split("T")[0],
        shop: row.ToShopName,
        product: row.ProductName,
        sent: Number(row.QtyAsPerMTN || 0),
        received: Number(row.QtyReceived || 0),
        diff: Number(row.Variance || 0),
        complaint: row.Complaint || "",
        status: row.Status
      }))
      .filter((row) => row.date >= startDate && row.date <= endDate)
      .filter((row) => row.status === "Received" && row.sent !== row.received);
  }, [endDate, mtnRows, startDate]);

  const loadStocks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shopsResponse, stockResponse, mtnResponse] = await Promise.all([
        appsScriptClient.getShops(),
        appsScriptClient.getDailyStockReport({ shopId: shopId || undefined, startDate, endDate }),
        appsScriptClient.getMTNsForShop(shopId || "")
      ]);
      if (shopsResponse.success && shopsResponse.shops) setShops(shopsResponse.shops);
      if (stockResponse.success && stockResponse.stocks) setStocks(stockResponse.stocks);
      else setError(stockResponse.error || "Failed to load stock report.");
      if (mtnResponse.success && mtnResponse.mtns) setMtnRows(mtnResponse.mtns);
      else setMtnRows([]);
      const empRes = await appsScriptClient.getEmployees();
      if (empRes.success && empRes.employees) setEmployees(empRes.employees);
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading stock report.");
    } finally {
      setLoading(false);
    }
  }, [endDate, shopId, startDate]);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  const handleExcelExport = () => {
    exportToExcel(
      stocks,
      {
        Date: "Date",
        ShopName: "Shop",
        EmployeeName: "Employee",
        ProductName: "Description/Product",
        Category: "Category",
        UOM: "UOM",
        MTNNo: "MTN No",
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
      shopName: selectedShop?.ShopName,
      inchargeName: selectedShop?.InchargeName,
      generatedBy: user?.name,
      filename: buildReportFilename("Daily_Stock_Report", startDate, endDate),
      headers: ["Date", "Shop", "Product", "MTN", "Opening", "Receipt", "Sales", "Expected", "Actual", "Mismatch"],
      rows: stocks.map((stock) => [
        formatDateForDisplay(stock.Date),
        stock.ShopName,
        stock.ProductName,
        stock.MTNNo || "-",
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
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <Boxes className="h-6 w-6 text-primary" />
            Daily Stock Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Expected closing, actual closing, and mismatch audit by shop.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadStocks} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={handleExcelExport} disabled={stocks.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-50">
            <FileSpreadsheet className="h-4 w-4 text-green-700" />
            Excel
          </button>
          <button type="button" onClick={handlePdfExport} disabled={stocks.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            <FileDown className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <Filters shops={shops} shopId={shopId} setShopId={setShopId} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} employees={employees} employeeId={employeeId} setEmployeeId={setEmployeeId} />

      {/* Mismatch toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-bold cursor-pointer select-none hover:bg-secondary">
          <input type="checkbox" checked={mismatchOnly} onChange={(e) => setMismatchOnly(e.target.checked)} className="h-4 w-4 rounded border-input text-primary focus:ring-ring" />
          Show Mismatch Only
        </label>
        {totals.mismatchCount > 0 && <span className="rounded-full bg-red-100 border border-red-200 px-3 py-1 text-xs font-black text-red-700">{totals.mismatchCount} mismatches</span>}
      </div>

      {/* Mismatch by Employee Summary */}
      {mismatchByEmployee.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-red-200 bg-red-50 p-4">
            <h2 className="text-sm font-black text-red-800">⚠ Stock Mismatch by Employee</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-red-50/50 text-red-800 border-b border-red-200">
                <tr>
                  <th className="p-3 font-bold">Employee</th>
                  <th className="p-3 font-bold text-right">Mismatch Count</th>
                  <th className="p-3 font-bold">Products</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mismatchByEmployee.map((emp) => (
                  <tr key={emp.name} className="hover:bg-red-50/30">
                    <td className="p-3 font-bold">{emp.name}</td>
                    <td className="p-3 text-right font-black text-red-700">{emp.count}</td>
                    <td className="p-3 text-muted-foreground">{emp.items.map((i) => `${i.ProductName} (${i.Mismatch > 0 ? "+" : ""}${i.Mismatch})`).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MTN Receipt Mismatch */}
      {mtnMismatches.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-black text-amber-800">⚠ MTN Receipt Mismatch (Sent vs Received)</h2>
            <p className="text-[10px] text-amber-700 mt-0.5">Items where employee received different quantity than what was sent from HO.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-50/50 text-amber-800 border-b border-amber-200">
                <tr>
                  <th className="p-3 font-bold">MTN No</th>
                  <th className="p-3 font-bold">Date</th>
                  <th className="p-3 font-bold">Shop</th>
                  <th className="p-3 font-bold">Product</th>
                  <th className="p-3 font-bold text-right">Sent</th>
                  <th className="p-3 font-bold text-right">Received</th>
                  <th className="p-3 font-bold text-right">Shortage</th>
                  <th className="p-3 font-bold">Complaint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mtnMismatches.map((m, i) => (
                  <tr key={i} className="hover:bg-amber-50/30">
                    <td className="p-3 font-bold font-mono">{m.mtnNo}</td>
                    <td className="p-3">{formatDateForDisplay(m.date)}</td>
                    <td className="p-3">{m.shop}</td>
                    <td className="p-3 font-bold">{m.product}</td>
                    <td className="p-3 text-right font-semibold">{m.sent}</td>
                    <td className="p-3 text-right font-bold">{m.received}</td>
                    <td className={`p-3 text-right font-black ${m.diff < 0 ? "text-red-700" : "text-green-700"}`}>{m.diff > 0 ? "+" : ""}{m.diff}</td>
                    <td className="p-3 text-muted-foreground max-w-[200px] truncate">{m.complaint || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-black uppercase text-primary">OPTIFIRST TZ LIMITED</p>
        <h2 className="mt-1 text-lg font-black">Daily Stock Report</h2>
        <p className="mt-1 text-sm text-muted-foreground">{selectedShop?.ShopName || "All Shops"} · {getDateRangeLabel(startDate, endDate)}</p>
      </div>

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">Loading stock report...</div>
      ) : stocks.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">No stock entries found for the selected filters.</div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="border-b border-border bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Shop</th>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">MTN No</th>
                    <th className="p-3 text-right">Opening</th>
                    <th className="p-3 text-right">Receipt</th>
                    <th className="p-3 text-right">Sales</th>
                    <th className="p-3 text-right">Expected</th>
                    <th className="p-3 text-right">Actual</th>
                    <th className="p-3 text-right">Mismatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredStocks.map((stock) => (
                    <tr key={stock.EntryID} className="hover:bg-secondary/30">
                      <td className="p-3 font-bold">{formatDateForDisplay(stock.Date)}</td>
                      <td className="p-3">{stock.ShopName}</td>
                      <td className="p-3">{stock.EmployeeName || stock.EmployeeID}</td>
                      <td className="p-3 font-bold">{stock.ProductName}</td>
                      <td className="p-3 font-mono text-muted-foreground">{stock.MTNNo || "-"}</td>
                      <td className="p-3 text-right">{stock.OpeningStock} {stock.UOM}</td>
                      <td className="p-3 text-right">{stock.Receipt} {stock.UOM}</td>
                      <td className="p-3 text-right">{stock.Sales} {stock.UOM}</td>
                      <td className="p-3 text-right">{stock.ExpectedClosing} {stock.UOM}</td>
                      <td className="p-3 text-right font-bold">{stock.ActualClosing} {stock.UOM}</td>
                      <td className={`p-3 text-right font-black ${stock.Mismatch === 0 ? "text-green-700" : "text-red-700"}`}>{stock.Mismatch > 0 ? "+" : ""}{stock.Mismatch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totals.mismatchCount > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {totals.mismatchCount} stock lines have non-zero mismatch.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyStock;
