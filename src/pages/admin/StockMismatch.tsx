import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileDown, FileSpreadsheet, RefreshCw } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { DailyStockEntry, Shop, UserSession } from "../../types";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { exportToExcel } from "../../utils/exportExcel";
import { exportPaperReportToPdf } from "../../utils/exportPdf";
import { buildReportFilename } from "../../utils/reportTransforms";
import { getSessionUser } from "../../utils/session";
import { Filters } from "./DailySales";

export const StockMismatch: React.FC = () => {
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [startDate, setStartDate] = useState(getLocalDateInputValue());
  const [endDate, setEndDate] = useState(getLocalDateInputValue());
  const [stocks, setStocks] = useState<DailyStockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedShop = shops.find((shop) => shop.ShopID === shopId);

  const loadMismatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shopResponse, mismatchResponse] = await Promise.all([
        appsScriptClient.getShops(),
        appsScriptClient.getStockMismatchReport({ shopId: shopId || undefined, startDate, endDate })
      ]);
      if (shopResponse.success && shopResponse.shops) setShops(shopResponse.shops);
      if (mismatchResponse.success && mismatchResponse.stocks) setStocks(mismatchResponse.stocks);
      else setError(mismatchResponse.error || "Failed to load stock mismatch report.");
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading stock mismatches.");
    } finally {
      setLoading(false);
    }
  }, [endDate, shopId, startDate]);

  useEffect(() => {
    loadMismatches();
  }, [loadMismatches]);

  const handleExcelExport = () => {
    exportToExcel(
      stocks,
      {
        Date: "Date",
        ShopName: "Shop",
        EmployeeName: "Employee",
        ProductName: "Product",
        OpeningStock: "Opening",
        Receipt: "Receipt",
        Sales: "Sales",
        ExpectedClosing: "Expected Closing",
        ActualClosing: "Actual Closing",
        Mismatch: "Mismatch"
      },
      buildReportFilename("Stock_Mismatch", startDate, endDate),
      "StockMismatch"
    );
  };

  const handlePdfExport = () => {
    exportPaperReportToPdf({
      title: "Stock Mismatch Report",
      startDate,
      endDate,
      shopName: selectedShop?.ShopName,
      inchargeName: selectedShop?.InchargeName,
      generatedBy: user?.name,
      filename: buildReportFilename("Stock_Mismatch_Report", startDate, endDate),
      headers: ["Date", "Shop", "Product", "Opening", "Receipt", "Sales", "Expected", "Actual", "Mismatch"],
      rows: stocks.map((stock) => [
        formatDateForDisplay(stock.Date),
        stock.ShopName,
        stock.ProductName,
        stock.OpeningStock,
        stock.Receipt,
        stock.Sales,
        stock.ExpectedClosing,
        stock.ActualClosing,
        `${stock.Mismatch > 0 ? "+" : ""}${stock.Mismatch} ${stock.UOM}`
      ]),
      totals: { mismatchCount: stocks.length }
    });
  };

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <AlertTriangle className="h-6 w-6 text-red-700" />
            Stock Mismatch
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Rows where actual closing differs from opening + receipt - sales.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadMismatches} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary">
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

      <Filters shops={shops} shopId={shopId} setShopId={setShopId} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">Loading stock mismatches...</div>
      ) : stocks.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">No stock mismatches found for the selected filters.</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            Outstanding mismatch rows: {stocks.length}
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-xs">
                <thead className="border-b border-border bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Shop</th>
                    <th className="p-3">Product</th>
                    <th className="p-3 text-right">Opening</th>
                    <th className="p-3 text-right">Receipt</th>
                    <th className="p-3 text-right">Sales</th>
                    <th className="p-3 text-right">Expected Closing</th>
                    <th className="p-3 text-right">Actual Closing</th>
                    <th className="p-3 text-right">Mismatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {stocks.map((stock) => (
                    <tr key={stock.EntryID} className="hover:bg-secondary/30">
                      <td className="p-3 font-bold">{formatDateForDisplay(stock.Date)}</td>
                      <td className="p-3">{stock.ShopName}</td>
                      <td className="p-3 font-bold">{stock.ProductName}</td>
                      <td className="p-3 text-right">{stock.OpeningStock} {stock.UOM}</td>
                      <td className="p-3 text-right">{stock.Receipt} {stock.UOM}</td>
                      <td className="p-3 text-right">{stock.Sales} {stock.UOM}</td>
                      <td className="p-3 text-right">{stock.ExpectedClosing} {stock.UOM}</td>
                      <td className="p-3 text-right font-bold">{stock.ActualClosing} {stock.UOM}</td>
                      <td className="p-3 text-right font-black text-red-700">{stock.Mismatch > 0 ? "+" : ""}{stock.Mismatch} {stock.UOM}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockMismatch;
